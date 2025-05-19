import { BunRuntime } from '@effect/platform-bun';
import {
  Chunk,
  Clock,
  Config,
  Duration,
  Effect,
  Metric,
  Stream,
  pipe,
} from 'effect';

import readline from 'node:readline';
import type { ConnectionConfig } from './connection-config';
import type { TcpStream } from './tcp-stream';
import { createTcpStream } from './tcp-stream';

import * as Redis from './redis/redis';

// Usage example
const program = Effect.gen(function* () {
  const config: ConnectionConfig = {
    host: 'datafeedcd3.cedrotech.com', // Replace with your host
    port: 81, // Replace with your port
    magicToken: yield* Config.string('CEDRO_TOKEN'), // Replace with your magic token
    username: yield* Config.string('CEDRO_USERNAME'), // Replace with your username
    password: yield* Config.string('CEDRO_PASSWORD'), // Replace with your password
    tickers: ['WINM25', 'WDOK25'],
  };

  const connection: TcpStream = yield* createTcpStream({
    host: config.host,
    port: config.port,
  });

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
        yield* Redis.publish('winfut', message);
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
        yield* Redis.publish('metrics', JSON.stringify(metrics));
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

BunRuntime.runMain(
  pipe(
    Effect.scoped(Effect.provide(program, Redis.redisLayer())),
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
