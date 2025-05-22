import { BunRuntime } from '@effect/platform-bun';
import {
  Chunk,
  Clock,
  Duration,
  Effect,
  Metric,
  Queue,
  Stream,
  pipe,
} from 'effect';
import { RedisPubSub, redisPubSubLayer } from './redis/redis';

const program = Effect.gen(function* () {
  const incomingQueue = yield* Queue.unbounded<string>();
  const redisPubSub = yield* RedisPubSub;
  const stream = Stream.fromQueue(incomingQueue);
  // Define metrics for message rate
  const messageCounter = Metric.counter('messages_received').pipe(
    Metric.tagged('source', 'tcp_stream'),
  );

  yield* redisPubSub.subscribe('winfut', (message: string) => {
    Queue.unsafeOffer(incomingQueue, message);
  });

  const messageProcessingTimeStream = pipe(
    stream,
    Stream.tap(() => Metric.increment(messageCounter)),
    Stream.mapEffect((message) =>
      Effect.gen(function* () {
        const t0 = yield* Clock.currentTimeMillis;
        yield* Effect.log(message);
        const t1 = yield* Clock.currentTimeMillis;
        return t1 - t0;
      }),
    ),
  );

  // (1) collect messages for ≤windowTime s OR ≤1 M items
  const windowTime = 1; // seconds
  const windowedStream = pipe(
    messageProcessingTimeStream,
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
        return {
          timestamp: now,
          windowCount, // msgs in this window,
          windowTime,
          totalCount: lifetime.count,
          messageRate: windowRate,
          avgProcessingTime: avgProcTime,
        };
      }),
    ),
  );

  yield* pipe(
    metricsStream,
    Stream.tap((message) =>
      redisPubSub.publish('winfut.metrics', JSON.stringify(message)),
    ),
    Stream.runDrain,
    Effect.fork,
  );
  yield* Effect.never;
});

BunRuntime.runMain(
  pipe(
    Effect.scoped(Effect.provide(program, redisPubSubLayer())),
    Effect.catchAll((error) => {
      return Effect.log(`🚫 Recovering from error ${error}`);
    }),
    Effect.catchAllCause((cause) => {
      return Effect.logError(
        `💥 Recovering from defect(${cause.toString().split('\n')[0]}) ${JSON.stringify(cause.toJSON(), null, 2)}`,
      );
    }),
  ),
);
