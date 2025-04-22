// Dump data to file
// keep running

import fs from "node:fs";
import path from "node:path";
import type { ConnectionConfig } from ".";

/**
 * CedroDumper class for handling data dumping functionality
 * This class provides methods to dump and analyze Cedro market data
 */
export class CedroDumper {
  private outputDir: string;
  private currentDumpFile: string | null = null;
  private fileStream: fs.WriteStream | null = null;
  private messageCount = 0;
  private startTime = process.hrtime.bigint();

  /**
   * Constructor for CedroDumper
   * @param outputDir Directory where dump files will be stored
   */
  constructor(outputDir = "./dumps") {
    this.outputDir = outputDir;
    this.ensureDirectoryExists();
  }

  /**
   * Ensures the output directory exists
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      console.log(`Created dump directory: ${this.outputDir}`);
    }
  }

  /**
   * Creates a new dump file with timestamp
   * @param prefix Optional prefix for the filename
   * @returns The path to the created file
   */
  public startNewDump(prefix = "cedro-dump"): string {
    // Close existing file if open
    this.closeDump();

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${prefix}-${timestamp}.txt`;
    this.currentDumpFile = path.join(this.outputDir, fileName);

    // Create write stream
    this.fileStream = fs.createWriteStream(this.currentDumpFile, { flags: "a" });
    this.messageCount = 0;
    this.startTime = process.hrtime.bigint();

    // Write header
    this.fileStream.write(`# Cedro Data Dump - Started at ${new Date().toISOString()}\n`);

    console.log(`Started new dump: ${this.currentDumpFile}`);
    return this.currentDumpFile;
  }

  /**
   * Dumps a message to the current dump file
   * @param message The raw message to dump
   * @returns Boolean indicating success
   */
  public dumpMessage(message: string): boolean {
    if (!this.fileStream) {
      console.warn("No active dump file. Call startNewDump() first.");
      return false;
    }

    try {
      // Write to file
      this.fileStream.write(`${message}\n`);

      this.messageCount++;
      return true;
    } catch (error) {
      console.error(`Error dumping message: ${error}`);
      return false;
    }
  }

  /**
   * Closes the current dump file
   */
  public closeDump(): void {
    if (this.fileStream) {
      const endTime = process.hrtime.bigint();
      const elapsedMs = Number(endTime - this.startTime) / 1_000_000;

      // Write footer with statistics
      this.fileStream.write(`\n# Dump completed at ${new Date().toISOString()}\n`);
      this.fileStream.write(`# Total messages: ${this.messageCount}\n`);
      this.fileStream.write(`# Elapsed time: ${elapsedMs.toFixed(2)}ms\n`);
      this.fileStream.write(
        `# Average rate: ${((this.messageCount * 1000) / elapsedMs).toFixed(2)} messages/second\n`
      );

      // Close the file
      this.fileStream.end();
      this.fileStream = null;
      console.log(`Closed dump file: ${this.currentDumpFile}`);
      this.currentDumpFile = null;
    }
  }

  /**
   * Filters a dump file for specific patterns
   * @param dumpFile Path to the dump file
   * @param pattern Pattern to filter for
   * @param outputFile Optional output file path
   * @returns Path to the filtered file
   */
  public static filterDump(dumpFile: string, pattern: string, outputFile?: string): string {
    if (!fs.existsSync(dumpFile)) {
      throw new Error(`Dump file not found: ${dumpFile}`);
    }

    // Generate output file name if not provided
    const finalOutputFile =
      outputFile ??
      (() => {
        const ext = path.extname(dumpFile);
        const base = path.basename(dumpFile, ext);
        const dir = path.dirname(dumpFile);
        return path.join(dir, `${base}-filtered-${Date.now()}${ext}`);
      })();

    // Read and filter file
    const content = fs.readFileSync(dumpFile, "utf8");
    const lines = content.split("\n");
    const outputStream = fs.createWriteStream(finalOutputFile);

    let inMatchingBlock = false;
    let matchCount = 0;

    // Write header
    outputStream.write(`# Filtered Cedro Data - Generated at ${new Date().toISOString()}\n`);
    outputStream.write(`# Original file: ${dumpFile}\n`);
    outputStream.write(`# Filter pattern: ${pattern}\n\n`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line?.includes("------------------")) {
        inMatchingBlock = false;
        outputStream.write(`${line}\n`);
      } else if (line?.match(pattern)) {
        inMatchingBlock = true;
        matchCount++;
        outputStream.write(`${line}\n`);
      } else if (inMatchingBlock && line) {
        outputStream.write(`${line}\n`);
      }
    }

    // Write footer
    outputStream.write(`\n# Filter completed at ${new Date().toISOString()}\n`);
    outputStream.write(`# Total matches: ${matchCount}\n`);

    outputStream.end();
    console.log(`Filtered dump saved to: ${finalOutputFile}`);
    console.log(`Found ${matchCount} matches for pattern: ${pattern}`);

    return finalOutputFile;
  }

  /**
   * Analyzes a dump file and returns statistics
   * @param dumpFile Path to the dump file
   * @returns Object containing statistics
   */
  public static analyzeDump(dumpFile: string): Record<string, unknown> {
    if (!fs.existsSync(dumpFile)) {
      throw new Error(`Dump file not found: ${dumpFile}`);
    }

    const content = fs.readFileSync(dumpFile, "utf8");
    const lines = content.split("\n");

    const stats = {
      totalMessages: 0,
      messageTypes: {} as Record<string, number>,
      tickers: {} as Record<string, number>,
      startTime: "",
      endTime: "",
      elapsedTime: 0,
    };

    // Extract start and end times from headers/footers
    for (const line of lines) {
      if (line?.startsWith("# Cedro Data Dump - Started at")) {
        stats.startTime = line.replace("# Cedro Data Dump - Started at ", "");
      } else if (line?.startsWith("# Dump completed at")) {
        stats.endTime = line.replace("# Dump completed at ", "");
      } else if (line?.startsWith("# Total messages:")) {
        stats.totalMessages = Number.parseInt(line.replace("# Total messages: ", ""), 10);
      } else if (line?.startsWith("# Elapsed time:")) {
        stats.elapsedTime = Number.parseFloat(
          line.replace("# Elapsed time: ", "").replace("ms", "")
        );
      }
    }

    // Analyze message types and tickers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip headers, footers, and separators
      if (
        !line ||
        line.startsWith("#") ||
        line.includes("------------------") ||
        line.trim() === ""
      ) {
        continue;
      }

      // Analyze message type
      const messageType = line.substring(0, 1);
      stats.messageTypes[messageType] = (stats.messageTypes[messageType] || 0) + 1;

      // Extract ticker if present (assuming format like T:WINJ25:...)
      const tickerMatch = line.match(/[A-Z]:([\w\d]+):/);
      if (tickerMatch?.[1]) {
        const ticker = tickerMatch[1];
        stats.tickers[ticker] = (stats.tickers[ticker] || 0) + 1;
      }
    }

    return stats;
  }
}

// Export a default instance for convenience
export const dumper = new CedroDumper();

// Export utility functions
export const startDump = (prefix?: string) => dumper.startNewDump(prefix);
export const dumpMessage = (message: string) => dumper.dumpMessage(message);
export const closeDump = () => dumper.closeDump();
export const filterDump = CedroDumper.filterDump;
export const analyzeDump = CedroDumper.analyzeDump;

const config: ConnectionConfig = {
  host: "datafeedcd3.cedrotech.com", // Replace with your host
  port: 81, // Replace with your port
  magicToken: "fake-token", // Replace with your magic token
  username: "00000", // Replace with your username
  password: "00000", // Replace with your password
  tickers: ["WINM25"],
};

async function main(): Promise<void> {
  console.log("Starting Cedro Dump");

  // Add signal handler for graceful shutdown
  let socket: { end: () => void; write: (data: string) => void } | null = null;

  // Handle SIGINT (Ctrl+C) and SIGTERM
  const handleSignal = (signal: string) => {
    console.log(`\nReceived ${signal}, closing connection and dump file...`);
    if (socket) {
      try {
        socket.end();
      } catch (error) {
        console.error("Error closing socket:", error);
      }
    }
    closeDump();
    console.log("Dump file closed successfully. Exiting.");
    process.exit(0);
  };

  // Register signal handlers
  process.on("SIGINT", () => handleSignal("SIGINT"));
  process.on("SIGTERM", () => handleSignal("SIGTERM"));

  await Bun.connect({
    hostname: config.host,
    port: config.port,
    socket: {
      open: async (s) => {
        socket = s;
        startDump();
        socket.write(`${config.magicToken}\n`);
        socket.write(`${config.username}\n`);
        socket.write(`${config.password}\n`);
        for (const ticker of config.tickers || []) {
          socket.write(`sqt ${ticker}\n`);
        }
      },
      data: async (s, data) => {
        const message = Buffer.from(data).toString().trim();
        console.log(message);
        dumpMessage(message);
      },
      close: async (s) => {
        console.log("Connection closed by server");
        closeDump();
      },
      error: async (s, error) => {
        console.error("Connection error:", error.message);
        closeDump();
        process.exit(1);
      },
      drain: () => {},
    },
  });
}

// Use Bun's module detection instead of Node.js's
if (import.meta.main) {
  main().catch((err) => {
    console.error("Error in main:", err);
    process.exit(1);
  });
}
