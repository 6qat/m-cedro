import { Effect, Stream, Queue, pipe } from "effect";

// =========================================================================
// TCP Connection with Write support
// =========================================================================
interface TcpConnection {
  readonly stream: Stream.Stream<Uint8Array, Error>;
  readonly send: (data: Uint8Array) => Effect.Effect<void>;
  readonly sendText: (data: string) => Effect.Effect<void>;
  readonly close: Effect.Effect<void>;
}

export const createTcpConnection = (options: {
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
