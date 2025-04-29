import { Effect, Stream, Queue, pipe, Console } from "effect";

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

const program = pipe(
  createTcpStream({ host: "datafeedcd3.cedrotech.com", port: 81 }),
  Stream.tap((e) => Console.log(Effect.runSync(e))),
  Stream.runCollect,
  Effect.flatMap((chunks) => Effect.log(`Received ${chunks.length} chunks`))
);

Effect.runPromise(program);
