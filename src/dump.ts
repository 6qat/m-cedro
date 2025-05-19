import { NodeRuntime } from '@effect/platform-node';
import {
  Config,
  Console,
  Duration,
  Effect,
  Fiber,
  Stream,
  pipe,
  Metric,
  MetricBoundaries,
  Clock,
} from 'effect';

import type { TcpStream } from './tcp-stream';
import { createTcpStream } from './tcp-stream';
import readline from 'node:readline';
import type { ConnectionConfig } from './connection-config';

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

  // Track message rate over time using a counter with a timestamp
  let lastTimestamp = Date.now();
  let lastCount = 0;

  // Track processing time using a simple average
  let totalProcessingTime = 0;
  let processedCount = 0;

  // Periodically publish metrics to Redis
  const logMetrics = yield* Effect.gen(function* () {
    while (true) {
      const now = Date.now();
      const currentCount = yield* Metric.value(messageCounter);
      const timeElapsed = (now - lastTimestamp) / 1000; // in seconds
      const messagesProcessed = currentCount.count - lastCount;

      // Calculate messages per second
      const messagesPerSecond =
        timeElapsed > 0 ? messagesProcessed / timeElapsed : 0;

      // Calculate average processing time
      const avgProcessingTime =
        processedCount > 0
          ? (totalProcessingTime / processedCount).toFixed(2)
          : '0';

      // Create metrics object
      const metrics = {
        timestamp: now,
        messageRate: messagesPerSecond,
        totalMessages: currentCount.count,
        avgProcessingTime: Number.parseFloat(avgProcessingTime),
        messagesProcessed: messagesProcessed,
      };

      // Publish metrics to Redis
      yield* Redis.publish('metrics', JSON.stringify(metrics));

      // Update for next interval
      lastTimestamp = now;
      lastCount = currentCount.count;

      // Reset processing time metrics for next interval
      totalProcessingTime = 0;
      processedCount = 0;

      yield* Effect.sleep(Duration.seconds(5));
    }
  }).pipe(Effect.fork);

  // Start reading from the TCP connection
  const readerFiber = yield* pipe(
    connection.stream,
    // Measure message rate and processing time
    Stream.tap(() => Metric.increment(messageCounter)),
    Stream.mapEffect((data) =>
      Effect.gen(function* () {
        const start = yield* Clock.currentTimeMillis;

        // Process the message here
        yield* Redis.publish('winfut', new TextDecoder().decode(data));

        const end = yield* Clock.currentTimeMillis;
        const duration = end - start;

        // Update processing time metrics
        totalProcessingTime += duration;
        processedCount++;

        return data; // Pass through the original data
      }),
    ),
    Stream.runDrain,
    Effect.fork,
  );

  // Ensure metrics logging is cleaned up
  yield* Effect.addFinalizer(() => Fiber.interrupt(logMetrics));

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
  yield* Fiber.join(readerFiber);
});

NodeRuntime.runMain(
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
