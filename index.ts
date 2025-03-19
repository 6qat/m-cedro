import * as net from "node:net";
import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseCedroMessage, formatCedroMessage } from "./cedroParser";

// Configuration interface
interface ConnectionConfig {
  host: string;
  port: number;
  magicToken: string;
  username: string;
  password: string;
}

class TcpClient {
  private client: net.Socket;
  private rl: readline.Interface;
  private messageCount = 0;
  private startTime = Date.now();
  private lastReportTime = Date.now();
  private reportInterval = 5000; // Report every 5 seconds
  private logFile: string;

  constructor() {
    this.client = new net.Socket();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Create log file name with today's date
    const today = new Date();
    const dateString = today.toISOString().split("T")[0]; // Format: YYYY-MM-DD
    this.logFile = `trades-${dateString}.txt`;

    // Create or clear the log file
    fs.writeFileSync(this.logFile, "");
    console.log(`Logging to file: ${this.logFile}`);
  }

  public connect(config: ConnectionConfig): void {
    // Connect to the TCP server
    this.client.connect(config.port, config.host, () => {
      console.log("Connected to server");
      this.logToFile(
        `Connected to ${config.host}:${
          config.port
        } at ${new Date().toISOString()}`
      );
      this.client.write(`${config.magicToken}\n`);
      this.client.write(`${config.username}\n`);
      this.client.write(`${config.password}\n`);
    });

    // Handle incoming data
    this.client.on("data", (data: Buffer) => {
      const message = data.toString().trim();
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
    });

    // Handle connection close
    this.client.on("close", () => {
      console.log("Connection closed");
      this.logToFile(`Connection closed at ${new Date().toISOString()}`);
      this.rl.close();
      process.exit(0);
    });

    // Handle errors
    this.client.on("error", (err: Error) => {
      console.error(`Connection error: ${err.message}`);
      this.logToFile(
        `Connection error: ${err.message} at ${new Date().toISOString()}`
      );
      this.cleanup();
    });

    // Start reading from console
    this.setupConsoleInput();
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
    // if (elapsed >= this.reportInterval) {
    const totalElapsed = (now - this.startTime) / 1000; // Convert to seconds
    const messagesPerSecond = this.messageCount / totalElapsed;
    const messagesInInterval = this.messageCount;

    const metrics = [
      "\n--- Performance Metrics ---",
      `Total messages: ${this.messageCount}`,
      `Elapsed time: ${totalElapsed.toFixed(2)} seconds`,
      `Average rate: ${messagesPerSecond.toFixed(2)} messages/second`,
      `Current rate: ${(messagesInInterval / (elapsed / 1000)).toFixed(
        2
      )} messages/second`,
      "---------------------------\n",
    ].join("\n");

    console.log(metrics);
    this.logToFile(metrics);

    // Reset interval counter
    this.lastReportTime = now;
    // }
  }

  private setupConsoleInput(): void {
    this.prompt();
  }

  private prompt(): void {
    this.rl.question("", (input: string) => {
      if (input.toLowerCase() === "exit") {
        this.cleanup();
        return;
      }

      // Send user input to server with newline
      this.client.write(`${input}\n`);
      this.logToFile(`User input: ${input}`);
      this.prompt();
    });
  }

  private cleanup(): void {
    this.client.destroy();
    this.rl.close();
    process.exit(0);
  }
}

// Example usage
function main(): void {
  const config: ConnectionConfig = {
    host: "datafeedcd3.cedrotech.com", // Replace with your host
    port: 81, // Replace with your port
    magicToken: "fake-token", // Replace with your magic token
    username: "00000", // Replace with your username
    password: "00000", // Replace with your password
  };

  const tcpClient = new TcpClient();
  tcpClient.connect(config);
}

if (require.main === module) {
  main();
}
