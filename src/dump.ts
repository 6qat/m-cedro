import { BunRuntime } from '@effect/platform-bun';
import {
  Clock,
  Config,
  Duration,
  Effect,
  Layer,
  Metric,
  Stream,
  pipe,
} from 'effect';

import readline from 'node:readline';
import {
  ConnectionConfig,
  ConnectionConfigLive,
  TcpStream,
  TcpStreamLive,
} from './tcp-stream';

import { RedisPubSub, redisPubSubLayer } from './redis/redis';

// Usage example
const program = Effect.gen(function* () {
  const redisPubSub = yield* RedisPubSub;

  const config = yield* ConnectionConfig;

  const connection = yield* TcpStream;

  const messageStream = pipe(
    connection.stream,
    Stream.map((chunk) => new TextDecoder().decode(chunk)),
    Stream.mapAccum(
      '' as string, // initial buffer
      (buffer, text) => {
        const combined = buffer + text;
        const parts = combined.split('\r\n'); // split on your delimiter
        const leftover = parts.pop() ?? ''; // last element may be incomplete
        return [leftover, parts] as const; // new buffer + array of full messages
      },
    ),
    Stream.flatMap((msgs) => Stream.fromIterable(msgs)),
  );

  const messageProcessingStream = pipe(
    messageStream,
    Stream.mapEffect((message) =>
      Effect.gen(function* () {
        yield* Effect.log(message);
        yield* redisPubSub.publish('raw', message);
      }),
    ),
  );

  // Run both streams
  yield* pipe(
    Stream.runDrain(messageProcessingStream),
    Effect.fork, // metrics publisher
  );

  // Ensure metrics logging is cleaned up
  // yield* Effect.addFinalizer(() => Fiber.interrupt(logMetrics));

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

  const shutdown = () => {
    // The readline effect loops indefinitely. When we close it,
    // the program will continue, closing the connection and
    // joining the readerFiber.
    rl.close();
  };

  // Handle SIGINT (Ctrl+C) and SIGTERM
  const handleSignal = async () => {
    shutdown();
  };
  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
  process.on('unhandledRejection', (_reason, _promise) => {
    // console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // process.exit(1);
    console.log('Unhandled Rejection.');
    shutdown();
  });

  // Setup readline interface for stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // Wrap readline in an Effect for cleanup
  yield* Effect.async((resume, signal) => {
    rl.on('line', (line) => {
      if (line === 'quit') {
        rl.close();
      } else {
        Effect.runPromise(connection.sendText(`${line}\n`));
      }
    });

    rl.on('close', () => {
      resume(Effect.succeed(undefined));
    });

    signal.addEventListener('abort', () => {
      rl.close();
    });
  });

  // When stdin closes, clean up TCP connection
  yield* connection.close;
});

const layerComposition = Effect.gen(function* () {
  const magicToken = yield* Config.string('CEDRO_TOKEN');
  const username = yield* Config.string('CEDRO_USERNAME');
  const password = yield* Config.string('CEDRO_PASSWORD');
  return Layer.provideMerge(
    Layer.provideMerge(
      TcpStreamLive(),
      ConnectionConfigLive(
        'datafeedcd3.cedrotech.com',
        81,
        ['WINM25', 'WDOK25'],
        magicToken,
        username,
        password,
      ),
    ),
    redisPubSubLayer(),
  );
});

const run = layerComposition.pipe(
  Effect.flatMap((layer) => program.pipe(Effect.provide(layer))),
);

// process.on('uncaughtException', (error, origin) => {
//   console.error('Uncaught Exception:', error);
//   console.error('Exception origin:', origin);
//   // Perform any cleanup if needed
//   // process.exit(1); // Optional: exit after handling
// });

BunRuntime.runMain(
  pipe(
    run,
    Effect.catchAll((error) => {
      return Effect.logError(`🚫 Recovering from error ${error}`);
    }),
    Effect.catchAllCause((cause) => {
      // console.log('Recovered from defect:', cause.toString().split('\n')[0]);
      return Effect.logError(
        `💥 Recovering from defect(${cause.toString().split('\n')[0]}) ${JSON.stringify(cause.toJSON(), null, 2)}`,
      );
    }),
  ),
);
