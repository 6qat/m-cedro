import * as net from "node:net";
import * as readline from "node:readline";
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

  constructor() {
    this.client = new net.Socket();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  public connect(config: ConnectionConfig): void {
    // Connect to the TCP server
    this.client.connect(config.port, config.host, () => {
      console.log("Connected to server");
      this.client.write(`${config.magicToken}\n`);
      this.client.write(`${config.username}\n`);
      this.client.write(`${config.password}\n`);
    });

    // Handle incoming data
    this.client.on("data", (data: Buffer) => {
      const message = data.toString().trim();
      const parsed = formatCedroMessage(parseCedroMessage(message));
      console.log(message);
      console.log(parsed);
      console.log("=================================================\n");
      this.prompt();
    });

    // Handle connection close
    this.client.on("close", () => {
      console.log("Connection closed");
      this.rl.close();
      process.exit(0);
    });

    // Handle errors
    this.client.on("error", (err: Error) => {
      console.error(`Connection error: ${err.message}`);
      this.cleanup();
    });

    // Start reading from console
    this.setupConsoleInput();
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
