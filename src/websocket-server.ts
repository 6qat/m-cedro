import { Effect, Stream, Queue, Fiber, pipe } from "effect";
import { Console } from "node:console";
import { webcrypto } from "node:crypto";
interface TcpClient {
  readonly id: string;
  readonly stream: Stream.Stream<Uint8Array, Error>;
  readonly send: (data: Uint8Array) => Effect.Effect<void>;
  readonly sendText: (data: string) => Effect.Effect<void>;
}

interface TcpServer {
  readonly clients: Stream.Stream<TcpClient, never>;
  readonly close: Effect.Effect<void>;
}

// Define your WebSocket data type
interface WebSocketData {
  id: string;
  // Add other properties as needed
  incomingQueue: Queue.Queue<Uint8Array>;
  outgoingQueue: Queue.Queue<Uint8Array>;
}

const createTcpServer = (options: {
  port: number;
  hostname?: string;
}): Effect.Effect<TcpServer, Error> => {
  return Effect.gen(function* () {
    /* Queue for new client connections. It will be transformed into a Stream
     and will be part of the TcpServer returned */
    const clientsQueue = yield* Queue.unbounded<TcpClient>();

    // Map to track active clients
    const clients = new Map<
      string,
      {
        fiber: Fiber.RuntimeFiber<void>;
        send: (data: Uint8Array) => Effect.Effect<void>;
      }
    >();

    const websocketHandler: Bun.WebSocketHandler<WebSocketData> = {
      // Connection opened
      open: (ws) => {
        const clientId = ws.data.id;
        console.log("Client connected: ", clientId);
        // Create client handler fiber
        const fiber = Effect.gen(function* () {
          const incomingQueue = yield* Queue.unbounded<Uint8Array>();
          const outgoingQueue = yield* Queue.unbounded<Uint8Array>();
          ws.data.incomingQueue = incomingQueue;
          ws.data.outgoingQueue = outgoingQueue;
          // Writer fiber
          yield* pipe(
            Effect.iterate(undefined, {
              while: () => true,
              body: () =>
                pipe(
                  Queue.take(outgoingQueue),
                  Effect.tap((data) => Effect.sync(() => ws.send(data))),
                  Effect.catchAll(() => Effect.void)
                ),
            }),
            Effect.fork
          );

          // Cleanup when closed
          yield* pipe(
            Effect.never,
            Effect.onInterrupt(() =>
              Effect.sync(() => {
                clients.delete(clientId);
                Queue.shutdown(incomingQueue);
                Queue.shutdown(outgoingQueue);
              })
            )
          );
        }).pipe(Effect.scoped, Effect.runFork);

        // Add to clients map
        clients.set(clientId, {
          fiber,
          send: (msg) => Queue.offer(ws.data.outgoingQueue, msg),
        });

        // Push client to connection stream
        Queue.unsafeOffer(clientsQueue, {
          id: clientId,
          stream: Stream.fromQueue(ws.data.incomingQueue),
          send: (data) => Queue.offer(ws.data.outgoingQueue, data),
          sendText: (data) =>
            Queue.offer(ws.data.outgoingQueue, new TextEncoder().encode(data)),
        });
      },

      // Message handler
      message: (ws, message) => {
        // console.log(message);
        const data =
          message instanceof Buffer
            ? new Uint8Array(message.buffer)
            : new TextEncoder().encode(message.toString());

        ws.data.incomingQueue && Queue.unsafeOffer(ws.data.incomingQueue, data);
      },

      // Connection closed
      close: (ws) => {
        const fiber = clients.get(ws.data.id)?.fiber;
        fiber && Fiber.interrupt(fiber);
      },
    };

    // Server instance
    const server = yield* Effect.try({
      try: () =>
        Bun.serve<WebSocketData, never>({
          port: options.port,
          hostname: options.hostname || "0.0.0.0",

          // Client connection handler
          async fetch(req, server) {
            if (
              server.upgrade(req, {
                // data: { id: Math.random().toString(36).substr(2, 9) },
                data: { id: webcrypto.randomUUID() },
              })
            ) {
              return;
            }
            return new Response("Upgrade failed", { status: 500 });
          },

          websocket: websocketHandler,
        }),
      catch: (error) => {
        // Threat errors in server creation (Bun.serve call) as defects
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(error as string);
      },
    });
    // End server instance creation

    // Server close effect
    const close = Effect.sync(() => {
      server.stop();
      for (const client of clients.values()) {
        client.fiber && Fiber.interrupt(client.fiber);
      }
    });

    // Returns the TCP server instance
    return {
      clients: Stream.fromQueue(clientsQueue),
      close,
    };
  });
};

// Usage example
const program = Effect.gen(function* () {
  const server = yield* createTcpServer({ port: 3000 });

  yield* pipe(
    server.clients,
    Stream.map((client) => client),
    Stream.tap((client) =>
      Effect.gen(function* () {
        yield* Effect.log(`New client connected: ${client.id}`);

        // Send welcome message
        yield* client.send(new TextEncoder().encode(`Welcome, ${client.id}!`));

        // Process client stream
        yield* pipe(
          client.stream,
          Stream.tap((data) =>
            Effect.gen(function* () {
              const message = new TextDecoder().decode(data);
              yield* Effect.log(`From ${client.id}: ${message}`);
              yield* client.sendText(message);
            })
          ),
          Stream.runDrain,

          Effect.fork
        ); // End client stream processing
      })
    ),
    Stream.runDrain,
    Effect.fork
  );

  // Keep server running until interrupted
  yield* Effect.never;
}).pipe(Effect.onInterrupt(() => Effect.log("Server shutdown")));

Effect.runPromise(
  pipe(
    program,
    Effect.catchAll((error) => {
      return Effect.log(`🚫 Recovering from error ${error}`);
    }),
    Effect.catchAllCause((cause) => {
      console.log("Recovered from defect:", cause.toString());
      return Effect.log(
        `💥 Recovering from defect ${JSON.stringify(cause.toJSON(), null, 2)}`
      );
    })
  )
);
