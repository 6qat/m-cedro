import Ably from 'ably';
import { ConvexClient } from 'convex/browser';
import { Option } from 'effect';
import { api } from '../convex/_generated/api';
import { formatCedroMessage, parseCedroMessage } from './cedro/cedroParser';
import type { ConnectionConfig } from './connection-config';
// Configuration interface

// Define a minimal interface for the socket
interface TcpSocket {
  write(data: string | Uint8Array): boolean;
  end(): void;
}

interface PerformanceMetrics {
  ticker: string;
  totalMessages: number; // messages (messages)
  totalElapsed: number; // seconds (total elapsed time)
  elapsed: number; // seconds (elapsed time)
  averageRate: number; // messages per second (average rate)
  currentRate: number; // messages per second (current rate)
}

class TcpClient {
  private client: TcpSocket | null = null;
  private messageCount = 0n;
  private startTime = process.hrtime.bigint();
  private lastReportTime = process.hrtime.bigint();
  private messagesInInterval = 1;
  private logFile: string;
  private logWriter: {
    write: (data: string) => number;
    flush: () => number | Promise<number>;
    end: () => void;
  }; // Type for FileSink with required methods
  private convexClient: ConvexClient;
  private ablyClient: Ably.Realtime;

  constructor() {
    this.convexClient = new ConvexClient(
      Bun.env.CONVEX_URL ? Bun.env.CONVEX_URL : '',
    );
    this.ablyClient = new Ably.Realtime({ key: Bun.env.ABLY_KEY });
    this.ablyClient.connection.once('connected', () => {
      console.log('Connected to Ably!');
    });

    // Create log file name with today's date using local time
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`; // Format: YYYY-MM-DD

    // Generate a filename with sequence number if needed
    this.logFile = this.generateUniqueLogFileName(dateString);

    // Create the log file and initialize the writer
    Bun.write(this.logFile, '');
    const file = Bun.file(this.logFile);
    this.logWriter = file.writer();

    console.log(`Logging to file: ${this.logFile}`);
  }

  public async connect(config: ConnectionConfig): Promise<void> {
    try {
      const channel = this.ablyClient.channels.get('davinci');
      await channel.subscribe('statistic', (message) => {
        console.log(`Message received: ${message.data}`);
      });

      // Connect to the TCP server using Bun.connect. Returns a socket which is ignored here.
      await Bun.connect({
        hostname: config.host,
        port: config.port,
        socket: {
          open: async (socket) => {
            console.log('Connected to server');
            await this.logToFile(
              `Connected to ${config.host}:${config.port} at ${new Date().toISOString()}`,
            );

            // Cast the socket to our interface
            this.client = socket as unknown as TcpSocket;
            this.client.write(`${config.magicToken}\n`);
            this.client.write(`${config.username}\n`);
            this.client.write(`${config.password}\n`);
            // Start reading from console after connection is established
            this.setupConsoleInput();
          },

          data: async (_socket, data) => {
            const messages = Buffer.from(data).toString().trim().split('!');
            for (const message of messages) {
              const parsed = formatCedroMessage(parseCedroMessage(message));

              if (!message.startsWith('T') && !message.startsWith('SYN')) {
                return;
              }
              this.messageCount++;

              // Log to console
              console.log('\n');
              console.log(message);
              console.log('\n');
              console.log(parsed);

              // Report message rate periodically
              const performanceMetrics = this.getPerformanceMetrics(1000);
              console.log('Is defined???', Option.isSome(performanceMetrics));
              Option.match(performanceMetrics, {
                onSome: (metrics) => {
                  console.log(
                    '=================================================',
                  );
                  console.log(metrics);
                  console.log(
                    '=================================================',
                  );
                  this.logToFile(
                    `Performance metrics: ${JSON.stringify(metrics, null, 2)}`,
                  );
                  channel.publish('statistic', JSON.stringify(metrics));
                },
                onNone: () => {
                  console.log('No performance metrics');
                },
              });

              // this.convexClient.mutation(api.cedro.sendRawMessage, {
              //   line: message,
              //   nano: Number(process.hrtime.bigint()),
              // });

              this.ablyClient; // Log to file
              this.logToFile(
                `${message}\n\n${parsed}\n=================================================\n`,
              );
            }
            // Increment message counter

            this.prompt();
          },

          close: async (_socket) => {
            console.log('Connection closed');
            this.logToFile(`Connection closed at ${new Date().toISOString()}`);
            this.cleanup();
          },
          error: async (_socket, error) => {
            console.error(`Connection error: ${error.message}`);
            this.logToFile(
              `Connection error: ${error.message} at ${new Date().toISOString()}`,
            );
            this.cleanup();
          },
          drain: () => {
            // Optional: Handle when the write buffer becomes empty
          },
        },
      });
    } catch (error) {
      console.error(
        `Connection error: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.logToFile(
        `Connection error: ${error instanceof Error ? error.message : String(error)} at ${new Date().toISOString()}`,
      );
      this.cleanup();
    }
  }

  private generateUniqueLogFileName(dateString: string): string {
    // Base filename without sequence number
    const baseFileName = `trades-${dateString}.txt`;

    // Check if file exists using Bun's file API
    const baseFile = Bun.file(baseFileName);
    const baseFileExists = baseFile.size > 0;

    if (!baseFileExists) {
      return baseFileName;
    }

    // File exists, try with sequence numbers
    let sequenceNumber = 1;
    let fileName = `trades-${dateString}-${sequenceNumber}.txt`;

    // Keep incrementing sequence number until we find an unused filename
    let fileExists = Bun.file(fileName).size > 0;
    while (fileExists) {
      sequenceNumber++;
      fileName = `trades-${dateString}-${sequenceNumber}.txt`;
      fileExists = Bun.file(fileName).size > 0;
    }

    return fileName;
  }

  private logToFile(content: string): void {
    try {
      // Using the persistent FileSink writer to append to the file
      this.logWriter.write(`${content}\n`);
      this.logWriter.flush();
    } catch (error) {
      console.error(`Error writing to log file: ${error}`);
    }
  }

  // TODO: Colocar a métrica Contratos negociados por segundo
  // TODO: Colocar a métrica Taxa máxima atingida de mensagens por segundo
  private getPerformanceMetrics(
    interval = 20000,
  ): Option.Option<PerformanceMetrics> {
    const now = process.hrtime.bigint();
    const elapsed = (now - this.lastReportTime) / 1000n; // Convert to microseconds

    if (Number(elapsed) / 1000 < interval) {
      console.log(`Elapsed: ${Number(elapsed) / 1000} < ${interval}`);
      this.messagesInInterval++;
      return Option.none();
    }
    const totalElapsed = (now - this.startTime) / 1000n; // Convert to microseconds
    const messagesPerMicroSecond =
      Number(this.messageCount) / Number(totalElapsed);

    const performanceMetrics: PerformanceMetrics = {
      ticker: 'WINJ25',
      totalMessages: Number(this.messageCount),
      totalElapsed: Number(totalElapsed) / 1000000, // seconds
      elapsed: Number(elapsed) / 1000000, // seconds
      averageRate: messagesPerMicroSecond * 1000000, // messages/second
      currentRate:
        (Number(this.messagesInInterval) * 1000000) / Number(elapsed), // messages/second
    };
    // Reset interval counter
    this.lastReportTime = now;
    this.messagesInInterval = 1;

    return Option.some(performanceMetrics);
  }

  private setupConsoleInput(): void {
    // Set up Bun's stdin to handle user input
    process.stdin.on('data', async (data: Buffer) => {
      const input = data.toString().trim();

      if (input.toLowerCase() === 'exit') {
        this.cleanup();
        return;
      }

      // Send user input to server with newline
      if (this.client) {
        this.client.write(`${input}\n`);
        await this.logToFile(`User input: ${input}`);
      }
    });

    this.prompt();
  }

  private prompt(): void {
    // Simple prompt for user input
    process.stdout.write('> ');
  }

  private cleanup(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
    if (this.convexClient) {
      this.convexClient.close();
    }

    // Close the log writer
    if (this.logWriter) {
      this.logWriter.end();
    }

    process.exit(0);
  }
}

// Example usage
async function main(): Promise<void> {
  const config: ConnectionConfig = {
    host: 'datafeedcd3.cedrotech.com', // Replace with your host
    port: 81, // Replace with your port
    magicToken: 'fake-token', // Replace with your magic token
    username: '00000', // Replace with your username
    password: '00000', // Replace with your password
  };

  const tcpClient = new TcpClient();
  await tcpClient.connect(config);
}

// Use Bun's module detection instead of Node.js's
if (import.meta.main) {
  main().catch((err) => {
    console.error('Error in main:', err);
    process.exit(1);
  });
}
