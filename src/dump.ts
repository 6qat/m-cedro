import { BunRuntime } from '@effect/platform-bun';
import {
  Chunk,
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
  createTcpStream,
  TcpStream,
  TcpStreamLive,
  ConnectionConfigLive,
  ConnectionConfig,
} from './tcp-stream';

import { RedisPubSub, redisPubSubLayer } from './redis/redis';

// Usage example
const program = Effect.gen(function* () {
  const redisPubSub = yield* RedisPubSub;

  const config = yield* ConnectionConfig;

  const connection = yield* TcpStream;

  // Define metrics for message rate
  const messageCounter = Metric.counter('messages_received').pipe(
    Metric.tagged('source', 'tcp_stream'),
  );

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
    Stream.tap(() => Metric.increment(messageCounter)),
    Stream.mapEffect((message) =>
      Effect.gen(function* () {
        const t0 = yield* Clock.currentTimeMillis;
        yield* Effect.log(message);
        yield* redisPubSub.publish('raw', message);
        const t1 = yield* Clock.currentTimeMillis;
        return t1 - t0;
      }),
    ),
  );

  // (1) collect messages for ≤5 s OR ≤1 M items
  const windowTime = 1; // seconds
  const windowedStream = pipe(
    messageProcessingStream,
    Stream.groupedWithin(1_000_000, Duration.seconds(windowTime)),
    Stream.map((times) => {
      const count = Chunk.size(times);
      const totalMillis = Chunk.reduce(times, 0, (acc, t) => acc + t);
      return { count, totalMillis };
    }),
  );

  // (2) add a messages/second moving average over the last N windows
  const rateWindowSize = 10; // number of windows to average
  const rateStream = pipe(
    windowedStream,
    Stream.map(({ count, totalMillis }) => ({
      count,
      totalMillis,
      rate: count / windowTime,
    })),
    Stream.mapAccum([] as number[], (rates, { count, totalMillis, rate }) => {
      const nextRates = [...rates, rate];
      if (nextRates.length > rateWindowSize) nextRates.shift();
      const movingAvg = nextRates.reduce((a, b) => a + b, 0) / nextRates.length;
      return [nextRates, { count, totalMillis, rate, movingAvg }] as const;
    }),
  );
  // (3) map rateStream → metrics object and publish
  const metricsStream = pipe(
    rateStream,
    Stream.mapEffect(({ count, totalMillis, movingAvg }) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const windowCount = count;
        const lifetime = yield* Metric.value(messageCounter);
        const windowRate = movingAvg; // msgs/s in windowTime window
        const avgProcTime =
          windowCount > 0 ? Number((totalMillis / windowCount).toFixed(2)) : 0;
        const metrics = {
          timestamp: now,
          windowCount, // msgs in this window,
          windowTime,
          totalCount: lifetime.count,
          messageRate: windowRate,
          avgProcessingTime: avgProcTime,
        };
        yield* redisPubSub.publish('metrics', JSON.stringify(metrics));
        return metrics;
      }),
    ),
  );

  // Run both streams
  yield* pipe(
    Stream.runDrain(metricsStream),
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
  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);

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

const composition = Layer.provideMerge(
  Layer.provideMerge(
    TcpStreamLive(),
    ConnectionConfigLive('datafeedcd3.cedrotech.com', 81, ['WINM25', 'WDOK25']),
  ),
  redisPubSubLayer(),
);

const runnable = program.pipe(Effect.provide(composition));

BunRuntime.runMain(
  pipe(
    runnable,
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
