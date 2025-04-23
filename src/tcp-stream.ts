import { Effect, Stream, Queue, pipe, Console, Fiber } from "effect";
import readline from "node:readline";
import type { ConnectionConfig } from ".";

const createTcpStream = (options: {
  host: string;
  port: number;
}): Stream.Stream<Effect.Effect<string, Error>, Error> => {
  return pipe(
    // Create an unbounded queue to buffer incoming data
    Queue.unbounded<Effect.Effect<string, Error>>(),
    Effect.flatMap((queue) => {
      // Create the TCP connection
      const socket = Bun.connect({
        hostname: options.host,
        port: options.port,
        socket: {
          data(socket, data) {
            // When data is received, offer it to the queue
            Queue.unsafeOffer(
              queue,
              Effect.succeed(Buffer.from(data).toString())
            );
          },
          open(socket) {
            // When the connection is opened, log it
            console.log("Connection opened");
          },
          error(socket, error) {
            // When an error occurs, fail the queue
            Queue.unsafeOffer(queue, Effect.fail(error));
          },
          close(socket) {
            // When the connection ends, shutdown the queue
            Queue.shutdown(queue);
            console.log("Connection closed");
          },
        },
      });

      // Return a stream that consumes from the queue
      // and ensures cleanup when the stream ends
      return Effect.succeed(
        Stream.fromQueue(queue).pipe(
          Stream.ensuring(
            Effect.sync(() => {
              socket.then((s) => s.end());
            })
          )
        )
      );
    }),
    Stream.unwrap
  );
};

// Usage example

const program1 = pipe(
  createTcpStream({ host: "datafeedcd3.cedrotech.com", port: 81 }),
  Stream.tap((e) => Console.log(Effect.runSync(e))),
  Stream.runCollect,
  Effect.flatMap((chunks) => Effect.log(`Received ${chunks.length} chunks`))
);

// Effect.runPromise(program1);

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
interface TcpConnection {
  readonly stream: Stream.Stream<Uint8Array, Error>;
  readonly send: (data: Uint8Array) => Effect.Effect<void>;
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
    const socket = Bun.connect({
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
    });

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
                  socket.then((s) => {
                    const bytesWritten = s.write(data);
                    if (bytesWritten !== data.length) {
                      throw new Error("Partial write");
                    }
                  });
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
      socket.then((s) => s.end());
      Queue.shutdown(incomingQueue);
      Queue.shutdown(outgoingQueue);
    });

    return {
      stream: Stream.fromQueue(incomingQueue).pipe(Stream.ensuring(close)),
      send: (data: Uint8Array) => Queue.offer(outgoingQueue, data),
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

  // Send credentials immediately after connection is established
  yield* connection.send(new TextEncoder().encode(`${config.magicToken}\n`));
  yield* connection.send(new TextEncoder().encode(`${config.username}\n`));
  yield* connection.send(new TextEncoder().encode(`${config.password}\n`));

  // Send SQT command for each ticker
  for (const ticker of config.tickers || []) {
    yield* connection.send(new TextEncoder().encode(`sqt ${ticker}\n`));
  }

  // Start reading from the TCP connection
  const readerFiber = yield* pipe(
    connection.stream,
    Stream.tap((data) =>
      Console.log(`Received: ${new TextDecoder().decode(data)}`)
    ),
    Stream.runDrain,
    Effect.fork
  );

  // Setup readline interface for stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // Wrap readline in an Effect for cleanup
  yield* Effect.async((resume, signal) => {
    rl.on("line", (line) => {
      void Effect.runPromise(
        connection.send(new TextEncoder().encode(`${line}\n`))
      );
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
