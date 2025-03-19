import * as fs from "node:fs";
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
  private messageCount = 0;
  private startTime = Date.now();
  private lastReportTime = Date.now();
  private logFile: string;
  private inputBuffer = "";

  constructor() {
    // Create log file name with today's date
    const today = new Date();
    const dateString = today.toISOString().split("T")[0] as string; // Format: YYYY-MM-DD

    // Generate a filename with sequence number if needed
    this.logFile = this.generateUniqueLogFileName(dateString);

    // Create or clear the log file
    fs.writeFileSync(this.logFile, "");
    console.log(`Logging to file: ${this.logFile}`);
  }

  private generateUniqueLogFileName(dateString: string): string {
    // Base filename without sequence number
    const baseFileName = `trades-${dateString}.txt`;

    // Check if file exists
    if (!fs.existsSync(baseFileName)) {
      return baseFileName;
    }

    // File exists, try with sequence numbers
    let sequenceNumber = 1;
    let fileName = `trades-${dateString}-${sequenceNumber}.txt`;

    // Keep incrementing sequence number until we find an unused filename
    while (fs.existsSync(fileName)) {
      sequenceNumber++;
      fileName = `trades-${dateString}-${sequenceNumber}.txt`;
    }

    return fileName;
  }

  public async connect(config: ConnectionConfig): Promise<void> {
    try {
      // Connect to the TCP server using Bun.connect
      const socket = await Bun.connect({
        hostname: config.host,
        port: config.port,
        socket: {
          data: (socket, data) => {
            const message = Buffer.from(data).toString().trim();
            const parsed = formatCedroMessage(parseCedroMessage(message));

            // Increment message counter
            this.messageCount++;

            // Report message rate periodically
            this.reportMessageRate();

            // Log to console
            console.log(message);
            console.log("\n");
            console.log(parsed);
            console.log("=================================================\n");

            // Log to file
            this.logToFile(
              `${message}\n\n${parsed}\n=================================================\n`
            );

            this.prompt();
          },
          open: (socket) => {
            console.log("Connected to server");
            this.logToFile(`Connected to ${config.host}:${config.port} at ${new Date().toISOString()}`);
            socket.write(`${config.magicToken}\n`);
            socket.write(`${config.username}\n`);
            socket.write(`${config.password}\n`);
            
            // Start reading from console after connection is established
            this.setupConsoleInput();
          },
          close: (socket) => {
            console.log("Connection closed");
            this.logToFile(`Connection closed at ${new Date().toISOString()}`);
            this.cleanup();
          },
          error: (socket, error) => {
            console.error(`Connection error: ${error.message}`);
            this.logToFile(`Connection error: ${error.message} at ${new Date().toISOString()}`);
            this.cleanup();
          },
          drain: () => {
            // Optional: Handle when the write buffer becomes empty
          }
        }
      });
      
      // Cast the socket to our interface
      this.client = socket as unknown as TcpSocket;

      // Send authentication after connection
      if (this.client) {
        this.client.write(`${config.magicToken}\n`);
        this.client.write(`${config.username}\n`);
        this.client.write(`${config.password}\n`);
        
        console.log("Connected to server");
        this.logToFile(`Connected to ${config.host}:${config.port} at ${new Date().toISOString()}`);
        
        // Start reading from console
        this.setupConsoleInput();
      }
    } catch (error) {
      console.error(`Connection error: ${error instanceof Error ? error.message : String(error)}`);
      this.logToFile(`Connection error: ${error instanceof Error ? error.message : String(error)} at ${new Date().toISOString()}`);
      this.cleanup();
    }
  }

  private logToFile(content: string): void {
    try {
      fs.appendFileSync(this.logFile, `${content}\n`);
    } catch (error) {
      console.error(`Error writing to log file: ${error}`);
    }
  }

  private reportMessageRate(): void {
    const now = Date.now();
    const elapsed = now - this.lastReportTime;

    // Report message rate every reportInterval milliseconds
    const totalElapsed = (now - this.startTime) / 1000; // Convert to seconds
    const messagesPerSecond = this.messageCount / totalElapsed;
    const messagesInInterval = this.messageCount;

    const metrics = [
      "\n--- Performance Metrics ---",
      `Total messages: ${this.messageCount}`,
      `Elapsed time: ${totalElapsed.toFixed(2)} seconds`,
      `Average rate: ${messagesPerSecond.toFixed(2)} messages/second`,
      `Current rate: ${(messagesInInterval / (elapsed / 1000)).toFixed(2)} messages/second`,
      "---------------------------\n",
    ].join("\n");

    console.log(metrics);
    this.logToFile(metrics);

    // Reset interval counter
    this.lastReportTime = now;
  }

  private setupConsoleInput(): void {
    // Set up Bun's stdin to handle user input
    process.stdin.on("data", (data: Buffer) => {
      const input = data.toString().trim();
      
      if (input.toLowerCase() === "exit") {
        this.cleanup();
        return;
      }

      // Send user input to server with newline
      if (this.client) {
        this.client.write(`${input}\n`);
        this.logToFile(`User input: ${input}`);
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
  main().catch(err => {
    console.error("Error in main:", err);
    process.exit(1);
  });
}
