import net from 'node:net';
import { BunRuntime } from '@effect/platform-bun';
import {
  Config,
  Context,
  Data,
  Effect,
  Fiber,
  Layer,
  Queue,
  Stream,
  pipe,
} from 'effect';

class ConnectionError extends Data.TaggedError('ConnectionError')<{
  cause: unknown;
  message: string;
}> {}

class WritingError extends Data.TaggedError('WritingError')<{
  cause: unknown;
  message: string;
}> {}

class CedroError extends Data.TaggedError('CedroError')<{
  cause: unknown;
  message: string;
}> {}

type DataOrError =
  | { _tag: 'data'; value: Uint8Array }
  | { _tag: 'error'; error: ConnectionError | CedroError };

interface CedroConfigShape {
  host: string;
  port: number;
  magicToken?: string;
  username?: string;
  password?: string;
  tickers?: string[];
}

class CedroConfig extends Context.Tag('CedroConfig')<
  CedroConfig,
  CedroConfigShape
>() {}

const CedroConfigLive = (
  host: string,
  port: number,
  tickers: string[],
  magicToken: string,
  username: string,
  password: string,
) =>
  Layer.scoped(
    CedroConfig,
    Effect.succeed({
      host,
      port,
      magicToken,
      username,
      password,
      tickers,
    }),
  );

interface CedroStreamShape {
  readonly stream: Stream.Stream<Uint8Array, ConnectionError | CedroError>;
  readonly send: (
    data: Uint8Array,
  ) => Effect.Effect<void, ConnectionError | CedroError>;
  readonly sendText: (
    data: string,
  ) => Effect.Effect<void, ConnectionError | CedroError>;
}

class CedroStream extends Context.Tag('CedroStream')<
  CedroStream,
  CedroStreamShape
>() {}

const CedroStreamLive = Layer.effect(
  CedroStream,
  Effect.gen(function* () {
    const config = yield* CedroConfig;
    const incomingQueue = yield* Queue.unbounded<DataOrError>();
    const outgoingQueue = yield* Queue.unbounded<Uint8Array>();

    // Connect with 3s timeout
    const socket = yield* Effect.try({
      try: () =>
        net.createConnection({ port: config.port, host: config.host }, () => {
          console.log('Connected to server');
          Queue.unsafeOffer(
            outgoingQueue,
            new TextEncoder().encode(`${config.magicToken}\n`),
          );
          Queue.unsafeOffer(
            outgoingQueue,
            new TextEncoder().encode(`${config.username}\n`),
          );
          Queue.unsafeOffer(
            outgoingQueue,
            new TextEncoder().encode(`${config.password}\n`),
          );
        }),
      catch: (e) =>
        new ConnectionError({ cause: e, message: 'Connection failed' }),
    });

    // Listen for data/events
    socket.on('data', (data: Buffer) => {
      Queue.unsafeOffer(incomingQueue, {
        _tag: 'data',
        value: data,
      });
    });
    socket.on('error', () => {
      Queue.unsafeOffer(incomingQueue, {
        _tag: 'error',
        error: new ConnectionError({ cause: null, message: 'Socket error' }),
      });
      // Effect.runPromise(performShutdown);
    });
    socket.on('close', () => {
      Queue.unsafeOffer(incomingQueue, {
        _tag: 'error',
        error: new ConnectionError({
          cause: null,
          message: 'Connection closed',
        }),
      });
      // Effect.runPromise(performShutdown);
    });

    const writerFiber = yield* pipe(
      Effect.iterate(undefined, {
        while: () => true,
        body: () => {
          return pipe(
            Queue.take(outgoingQueue),
            Effect.flatMap((data) => {
              return Effect.try({
                try: () => {
                  const writtenOk = socket.write(data);
                  if (!writtenOk) {
                    throw new WritingError({
                      cause: null,
                      message: 'Could not write to socket.',
                    });
                  }
                },
                catch: (error) => {
                  // Too many errors, close the socket
                  if (error instanceof WritingError) {
                    return error;
                  }
                  return new WritingError({
                    cause: error,
                    message: 'Unknown error while writing.',
                  });
                },
              });
            }),
          );
        },
      }).pipe(Effect.map(() => void 0)),
      Effect.fork,
    );

    writerFiber.addObserver((_exit) => {
      return void 0;
    });

    // Cleanup

    const stream = Stream.fromQueue(incomingQueue).pipe(
      Stream.flatMap((msg) => {
        if (msg._tag === 'data') {
          return Stream.succeed(msg.value);
        }
        return Stream.fail(msg.error); // ends the stream with error
      }),
    );

    return {
      stream,
      send: (data: Uint8Array) => Queue.offer(outgoingQueue, data),
      sendText: (text: string) =>
        Queue.offer(outgoingQueue, new TextEncoder().encode(text)),
    } as const;
  }),
);

export { CedroConfigLive, CedroConfig, CedroStream, CedroStreamLive };

// =======================================================================
// Minimal example
// =======================================================================

const program = Effect.gen(function* () {
  const cedro = yield* CedroStream;
  const inputStream = yield* pipe(
    cedro.stream,
    Stream.tap((data) => {
      const message = new TextDecoder().decode(data);
      console.log(message);
      return Effect.log(message);
    }),
    Stream.runDrain,
    Effect.fork,
  );

  yield* Fiber.join(inputStream);
});

const runnable = Effect.gen(function* () {
  const magicToken = yield* Config.string('CEDRO_TOKEN');
  const username = yield* Config.string('CEDRO_USERNAME');
  const password = yield* Config.string('CEDRO_PASSWORD');

  const cedroConfig = CedroConfigLive(
    'datafeedcd3.cedrotech.com',
    81,
    ['WINM25', 'PETR4', 'BBAS3'],
    magicToken,
    username,
    password,
  );

  yield* program.pipe(
    Effect.provide(Layer.provideMerge(CedroStreamLive, cedroConfig)),
  );
});

BunRuntime.runMain(
  runnable.pipe(
    Effect.catchAll((error) =>
      Effect.log(`🚫 Recovering from error:  ${error}`),
    ),
    Effect.catchAllCause((cause) =>
      Effect.log(`💥Recovering from defect: ${cause}`),
    ),
  ),
);
