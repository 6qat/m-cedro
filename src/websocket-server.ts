import { Duration, Effect, Fiber, Queue, Ref, Stream, pipe } from 'effect';

interface TcpClient {
  readonly id: string;
  readonly stream: Stream.Stream<Uint8Array, Error>;
  readonly send: (data: Uint8Array) => Effect.Effect<void>;
  readonly sendText: (data: string) => Effect.Effect<void>;
}

interface TcpServer {
  readonly clients: Stream.Stream<TcpClient>;
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

        // Build client handler effect
        const clientEffect = pipe(
          Effect.scoped(
            Effect.gen(function* () {
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
                    ),
                }),
                // This effect will automatically clean up on parent interrupt
                Effect.forkScoped,
              );

              // Hangs the fiber, waiting for an interrupt signal
              yield* Effect.never;
            }),
          ),
          Effect.onInterrupt(() =>
            // Cleanup when closed
            Effect.gen(function* () {
              clients.delete(clientId);
              yield* Queue.shutdown(ws.data.incomingQueue);
              yield* Queue.shutdown(ws.data.outgoingQueue);
            }),
          ),
        ); // end client effect

        // Fork the composed effect (scoped)
        const clientFiber = Effect.runFork(clientEffect);

        // Add to clients map
        clients.set(clientId, {
          fiber: clientFiber,
          send: (msg) => Queue.offer(ws.data.outgoingQueue, msg),
        });

        // Push client to connection stream
        Queue.unsafeOffer(clientsQueue, {
          id: clientId,
          stream: Stream.fromQueue(ws.data.incomingQueue, { shutdown: true }),
          send: (data) => Queue.offer(ws.data.outgoingQueue, data),
          sendText: (data) =>
            Queue.offer(ws.data.outgoingQueue, new TextEncoder().encode(data)),
        });
      }, // end open callback

      // Message handler
      message: (ws, message) => {
        const data =
          Buffer.isBuffer(message)
            ? new Uint8Array(message.buffer)
            : new TextEncoder().encode(message.toString());

        ws.data.incomingQueue && Queue.unsafeOffer(ws.data.incomingQueue, data);
      }, // end message callback

      // Connection closed
      close: (ws) => {
        const fiber = clients.get(ws.data.id)?.fiber;
        fiber && Effect.runPromiseExit(Fiber.interrupt(fiber)).then(Effect.log);
      }, // end close callback
    }; // End of websocket handler

    const closeAlreadyCalled = yield* Ref.make(false);
    // Server instance
    const bunServer = yield* Effect.try({
      try: () =>
        Bun.serve<WebSocketData, never>({
          port: options.port,
          hostname: options.hostname || '0.0.0.0',

          // Client connection handler
          async fetch(req, server) {
            if (
              server.upgrade(req, {
                data: { id: Math.random().toString(36).substring(2, 9) },
                //data: { id: webcrypto.randomUUID() },
              })
            ) {
              return;
            }
            return new Response('Upgrade failed', { status: 500 });
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
    const close = Effect.gen(function* () {
      // const already = yield* Ref.getAndSet(closeAlreadyCalled, true);
      // if (already) return;
      yield* Effect.if(closeAlreadyCalled, {
        onTrue: () => Effect.void,
        onFalse: () =>
          Effect.gen(function* () {
            // yield* Effect.log("Server shutting down");
            bunServer.stop(); // Stop listening to prevent new connections from being accepted.
            yield* Effect.sleep(Duration.millis(200));
            yield* Effect.forEach(
              Array.from(clients.values()),
              (client) =>
                client.fiber ? Fiber.interrupt(client.fiber) : Effect.void,
              { concurrency: 'unbounded' },
            );
            yield* Queue.shutdown(clientsQueue);
            yield* Ref.set(closeAlreadyCalled, true);
          }),
      });
    });

    // Returns the TCP server instance
    return {
      clients: Stream.fromQueue(clientsQueue, { shutdown: true }),
      close,
    };
  });
};

// Usage example

const handleClient = (client: TcpClient) =>
  Effect.gen(function* () {
    yield* Effect.log(`New client connected: ${client.id}`);

    // Send welcome message
    yield* client.sendText(`Welcome, ${client.id}!`);

    // Process client stream
    yield* pipe(
      client.stream,
      Stream.tap((data) =>
        Effect.gen(function* () {
          const message = new TextDecoder().decode(data);
          yield* Effect.log(`From ${client.id}: ${message}`);
          yield* client.sendText(message);
        }),
      ),
      Stream.onDone(() => Effect.log(`Client ${client.id} disconnected!`)),
      Stream.runFold(0, (count, _) => count + 1),
      Effect.tap((count) =>
        Effect.log(
          `Stream (client ${client.id}) completed after ${count} items`,
        ),
      ),
      Stream.runDrain,
      Effect.fork,
    ); // End client stream processing
  });

const shutdownSignal = Effect.async((resume) => {
  const onExit = () => resume(Effect.void);
  process.once('SIGINT', onExit);
  process.once('SIGTERM', onExit);
});

const program = Effect.gen(function* () {
  const server = yield* Effect.acquireRelease(
    createTcpServer({ port: 3030 }),
    (server) =>
      Effect.gen(function* () {
        yield* Effect.log('Server shut down');
        yield* server.close;
      }),
  );

  yield* Effect.log('Server started');

  // Create a new stream for each connected client
  const clientsStreamFiber = yield* pipe(
    server.clients,
    Stream.tap((client) => handleClient(client)),
    Stream.onDone(() => Effect.log('Clients stream completed')),
    Stream.runDrain,
    Effect.fork,
  );

  yield* shutdownSignal;
  yield* Effect.log('Shutting down server');
  yield* Effect.log('Closing client connections');
  yield* server.close;
  yield* Fiber.join(clientsStreamFiber);
});

Effect.runPromise(
  pipe(
    Effect.scoped(program),
    Effect.tap(() => Effect.log('Program finished')),
    Effect.catchAll((error) => {
      return Effect.log(`🚫 Recovering from error ${error}`);
    }),
    Effect.catchAllCause((cause) => {
      console.log('Recovered from defect:', cause.toString());
      return Effect.log(
        `💥 Recovering from defect ${JSON.stringify(cause.toJSON(), null, 2)}`,
      );
    }),
  ),
);
