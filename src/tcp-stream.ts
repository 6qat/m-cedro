import { Effect, Stream, Queue, pipe, Console, Fiber, Duration } from "effect";
import readline from "node:readline";
import type { ConnectionConfig } from ".";

// =========================================================================
// TCP Connection with Write support
// =========================================================================
const config: ConnectionConfig = {
  host: "datafeedcd3.cedrotech.com", // Replace with your host
  port: 81, // Replace with your port
  magicToken: "fake-token", // Replace with your magic token
  username: "00000", // Replace with your username
  password: "00000", // Replace with your password
  tickers: ["WINM25", "WDOK25"],
};
export interface TcpConnection {
  readonly stream: Stream.Stream<Uint8Array, Error>;
  readonly send: (data: Uint8Array) => Effect.Effect<void>;
  readonly sendText: (data: string) => Effect.Effect<void>;
  readonly close: Effect.Effect<void>;
}

const createTcpConnection = (options: {
  host: string;
  port: number;
}): Effect.Effect<TcpConnection, Error> => {
  return Effect.gen(function* () {
    // Create queues for incoming and outgoing data
    const incomingQueue = yield* Queue.unbounded<Uint8Array>();
    const outgoingQueue = yield* Queue.unbounded<Uint8Array>();

    // Create deferred for connection cleanup
    const socket = yield* Effect.tryPromise(() =>
      Bun.connect({
        port: options.port,
        hostname: options.host,
        socket: {
          data(_socket, data) {
            Queue.unsafeOffer(incomingQueue, data);
          },
          error(_socket, error) {
            //Queue.unsafeOffer(incomingQueue, error)
            Queue.shutdown(outgoingQueue);
          },
          close(_socket) {
            Queue.shutdown(incomingQueue);
            Queue.shutdown(outgoingQueue);
          },
        },
      })
    );

    // Fiber for writing outgoing data
    const writerFiber = yield* pipe(
      Effect.iterate(undefined, {
        while: () => true,
        body: () =>
          pipe(
            Queue.take(outgoingQueue),
            Effect.flatMap((data) =>
              Effect.try({
                try: () => {
                  const bytesWritten = socket.write(data);
                  if (bytesWritten !== data.length) {
                    throw new Error("Partial write");
                  }
                },
                catch: (error) => new Error(`Write failed: ${error}`),
              })
            )
          ),
      }),
      Effect.fork
    );

    // Cleanup procedure
    const close = Effect.sync(() => {
      console.log("Closing connection");
      socket.end();
      Queue.shutdown(incomingQueue);
      Queue.shutdown(outgoingQueue);
    });

    // returns TCPConnection
    return {
      stream: Stream.fromQueue(incomingQueue).pipe(Stream.ensuring(close)),
      send: (data: Uint8Array) => Queue.offer(outgoingQueue, data),
      sendText: (data: string) =>
        Queue.offer(outgoingQueue, new TextEncoder().encode(data)),
      close,
    };
  });
};

// Usage example
const program = Effect.gen(function* () {
  const connection = yield* createTcpConnection({
    host: config.host,
    port: config.port,
  });

  // Start reading from the TCP connection
  const readerFiber = yield* pipe(
    connection.stream,
    Stream.tap((data) =>
      Console.log(`Received: ${new TextDecoder().decode(data)}`)
    ),
    Stream.runDrain,
    Effect.fork
  );

  // Send credentials immediately after connection is established
  yield* connection.sendText(`${config.magicToken}\n`);
  yield* connection.sendText(`${config.username}\n`);
  yield* connection.sendText(`${config.password}\n`);

  // Send SQT command for each ticker
  yield* Effect.sleep(Duration.millis(1500));
  if (config.tickers) {
    for (const ticker of config.tickers) {
      yield* connection.sendText(`sqt ${ticker}\n`);
    }
  }

  const shutdown = async () => {
    // The readline effect loops indefinitely. When we close it,
    // the program will continue, closing the connection and
    // joining the readerFiber.
    rl.close();
  };

  // Handle SIGINT (Ctrl+C) and SIGTERM
  const handleSignal = async () => {
    shutdown();
  };
  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  // Setup readline interface for stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // Wrap readline in an Effect for cleanup
  yield* Effect.async((resume, signal) => {
    rl.on("line", (line) => {
      if (line === "quit") {
        rl.close();
      } else {
        Effect.runPromise(connection.sendText(`${line}\n`));
      }
    });

    rl.on("close", () => {
      resume(Effect.succeed(undefined));
    });

    signal.addEventListener("abort", () => {
      rl.close();
    });
  });

  // When stdin closes, clean up TCP connection
  yield* connection.close;
  yield* Fiber.join(readerFiber);
});

Effect.runPromise(program);
