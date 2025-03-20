import { parseCedroMessage, formatCedroMessage } from "./cedroParser";

// Configuration interface
interface ConnectionConfig {
  host: string;
  port: number;
  magicToken: string;
  username: string;
  password: string;
}

// Define a minimal interface for the socket
interface TcpSocket {
  write(data: string | Uint8Array): boolean;
  end(): void;
}

class TcpClient {
  private client: TcpSocket | null = null;
  private messageCount = 0n;
  private startTime = process.hrtime.bigint();
  private lastReportTime = process.hrtime.bigint();
  private logFile: string;
  private logWriter: {
    write: (data: string) => number;
    flush: () => number | Promise<number>;
    end: () => void;
  }; // Type for FileSink with required methods

  constructor() {
    // Create log file name with today's date
    const today = new Date();
    const dateString = today.toISOString().split("T")[0] as string; // Format: YYYY-MM-DD

    // Generate a filename with sequence number if needed
    this.logFile = this.generateUniqueLogFileName(dateString);

    // Create the log file and initialize the writer
    Bun.write(this.logFile, "");
    const file = Bun.file(this.logFile);
    this.logWriter = file.writer();

    console.log(`Logging to file: ${this.logFile}`);
  }

  // TODO: correct the used date
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

  public async connect(config: ConnectionConfig): Promise<void> {
    try {
      // Connect to the TCP server using Bun.connect. Returns a socket which is ignored here.
      await Bun.connect({
        hostname: config.host,
        port: config.port,
        socket: {
          data: async (socket, data) => {
            const message = Buffer.from(data).toString().trim();
            const parsed = formatCedroMessage(parseCedroMessage(message));

            // Increment message counter
            this.messageCount++;

            // Report message rate periodically
            await this.reportMessageRate();

            // Log to console
            console.log(message);
            console.log("\n");
            console.log(parsed);
            console.log("=================================================\n");

            // Log to file
            await this.logToFile(
              `${message}\n\n${parsed}\n=================================================\n`
            );

            this.prompt();
          },
          open: async (socket) => {
            console.log("Connected to server");
            // Cast the socket to our interface
            this.client = socket as unknown as TcpSocket;
            await this.logToFile(
              `Connected to ${config.host}:${config.port} at ${new Date().toISOString()}`
            );
            this.client.write(`${config.magicToken}\n`);
            this.client.write(`${config.username}\n`);
            this.client.write(`${config.password}\n`);
            // Start reading from console after connection is established
            this.setupConsoleInput();
          },
          close: async (socket) => {
            console.log("Connection closed");
            await this.logToFile(`Connection closed at ${new Date().toISOString()}`);
            this.cleanup();
          },
          error: async (socket, error) => {
            console.error(`Connection error: ${error.message}`);
            await this.logToFile(
              `Connection error: ${error.message} at ${new Date().toISOString()}`
            );
            this.cleanup();
          },
          drain: () => {
            // Optional: Handle when the write buffer becomes empty
          },
        },
      });
    } catch (error) {
      console.error(`Connection error: ${error instanceof Error ? error.message : String(error)}`);
      await this.logToFile(
        `Connection error: ${error instanceof Error ? error.message : String(error)} at ${new Date().toISOString()}`
      );
      this.cleanup();
    }
  }

  private async logToFile(content: string): Promise<void> {
    try {
      // Using the persistent FileSink writer to append to the file
      this.logWriter.write(`${content}\n`);
      await this.logWriter.flush();
    } catch (error) {
      console.error(`Error writing to log file: ${error}`);
    }
  }

  private async reportMessageRate(): Promise<void> {
    const now = process.hrtime.bigint();
    const elapsed = (now - this.lastReportTime) / 1000n; // Convert to microseconds
    const totalElapsed = (now - this.startTime) / 1000n; // Convert to microseconds
    const messagesPerMicroSecond = Number(this.messageCount) / Number(totalElapsed);
    const messagesInInterval = 1;

    const metrics = [
      "\n--- Performance Metrics ---",
      `Total messages: ${this.messageCount}`,
      `Total elapsed time: ${Number(totalElapsed) / 1000000} seconds`,
      `Elapsed time: ${Number(elapsed) / 1000000} seconds`,
      `Average rate: ${messagesPerMicroSecond * 1000000} messages/second`,
      `Current rate: ${(Number(messagesInInterval) * 1000000) / Number(elapsed)} messages/second`,
      "---------------------------\n",
    ].join("\n");

    console.log(metrics);
    await this.logToFile(metrics);

    // Reset interval counter
    this.lastReportTime = now;
  }

  private setupConsoleInput(): void {
    // Set up Bun's stdin to handle user input
    process.stdin.on("data", async (data: Buffer) => {
      const input = data.toString().trim();

      if (input.toLowerCase() === "exit") {
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
    process.stdout.write("> ");
  }

  private cleanup(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
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
    host: "datafeedcd3.cedrotech.com", // Replace with your host
    port: 81, // Replace with your port
    magicToken: "fake-token", // Replace with your magic token
    username: "00000", // Replace with your username
    password: "00000", // Replace with your password
  };

  const tcpClient = new TcpClient();
  await tcpClient.connect(config);
}

// Use Bun's module detection instead of Node.js's
if (import.meta.main) {
  main().catch((err) => {
    console.error("Error in main:", err);
    process.exit(1);
  });
}
