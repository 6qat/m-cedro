import { BunRuntime } from '@effect/platform-bun';
import {
  Chunk,
  Clock,
  Config,
  Duration,
  Effect,
  Layer,
  Metric,
  Queue,
  Stream,
  pipe,
} from 'effect';
import {
  RedisConnectionOptionsLive,
  RedisPubSub,
  RedisPubSubLive,
} from 'effect-redis';

const MetricsConfig = Config.all({
  windowSize: Config.integer('METRICS_WINDOW_MS').pipe(Config.withDefault(500)),
  rateWindowCount: Config.integer('RATE_WINDOW_COUNT').pipe(
    Config.withDefault(10),
  ),
  maxWindowMessages: Config.integer('MAX_WINDOW_MESSAGES').pipe(
    Config.withDefault(1_000_000),
  ),
}).pipe(Config.nested('metrics'));

interface Metrics {
  timestamp: number;
  windowCount: number;
  windowTime: number;
  totalCount: number;
  messageRate: number;
  avgProcessingTime: number;
}

interface AggregatedMetrics {
  timestamp: number;
  minRate: number;
  maxRate: number;
  avgRate: number;
  totalMessages: number;
  windowCount: number;
}

const validateMetrics = (metrics: Metrics) => {
  if (metrics.windowCount < 0) return false;
  if (metrics.messageRate < 0) return false;
  if (!Number.isFinite(metrics.avgProcessingTime)) return false;
  if (metrics.timestamp > Date.now() + 1000) return false; // Future timestamp check
  return true;
};

const program = Effect.gen(function* () {
  const incomingQueue = yield* Queue.unbounded<string>();

  const redisPubSub = yield* RedisPubSub;

  const config = yield* MetricsConfig;

  const stream = Stream.fromQueue(incomingQueue);

  // Define metrics for message rate
  const messageCounter = Metric.counter('messages_received').pipe(
    Metric.tagged('source', 'tcp_stream'),
  );

  yield* redisPubSub.subscribe('winfut', (message: string) => {
    Queue.unsafeOffer(incomingQueue, message);
  });

  const _messageProcessingTimeStream = pipe(
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
  const windowTime = config.windowSize / 1_000; // seconds
  const windowedStream = pipe(
    stream,
    Stream.tap(() => Metric.increment(messageCounter)),
    Stream.groupedWithin(
      config.maxWindowMessages,
      Duration.seconds(windowTime),
    ),
    Stream.map((times) => {
      const count = Chunk.size(times);
      // const totalMillis = Chunk.reduce(times, 0, (acc, t) => acc + t);
      const totalMillis = windowTime * 1_000;
      return { count, totalMillis };
    }),
  );

  // (2) add a messages/second moving average over the last N windows
  const rateWindowSize = config.rateWindowCount; // number of windows to average
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
  const metricsStream: Stream.Stream<Metrics> = pipe(
    rateStream,
    Stream.mapEffect(({ count, totalMillis, movingAvg }) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const windowCount = count;
        const lifetime = yield* Metric.value(messageCounter);
        const windowRate = movingAvg; // msgs/s in windowTime window
        const avgProcTime =
          windowCount > 0 ? Number((totalMillis / windowCount).toFixed(2)) : 0;

        const metrics: Metrics = {
          timestamp: now,
          windowCount, // msgs in this window,
          windowTime,
          totalCount: lifetime.count,
          messageRate: windowRate,
          avgProcessingTime: avgProcTime,
        };
        return metrics;
      }),
    ),
    Stream.filter(validateMetrics),
  );

  // Aggregate metrics over time windows
  const aggregatedMetrics = pipe(
    metricsStream,
    Stream.groupedWithin(1000, Duration.minutes(0.1)),
    Stream.map((metricsChunk) => {
      const metrics = Chunk.toArray(metricsChunk);
      if (metrics.length === 0) return null;

      const rates = metrics.map((m) => m.messageRate);
      const minRate = Math.min(...rates);
      const maxRate = Math.max(...rates);
      const sumRate = rates.reduce((sum, rate) => sum + rate, 0);
      const totalMessages = metrics.reduce((sum, m) => sum + m.windowCount, 0);

      return {
        timestamp: Date.now(),
        minRate: Number(minRate.toFixed(2)),
        maxRate: Number(maxRate.toFixed(2)),
        avgRate: Number((sumRate / metrics.length).toFixed(2)),
        totalMessages,
        windowCount: metrics.length,
      } as unknown as AggregatedMetrics;
    }),
    Stream.filter(
      (metrics): metrics is NonNullable<typeof metrics> => metrics !== null,
    ),
  );

  yield* pipe(
    aggregatedMetrics,
    Stream.tap((message) =>
      redisPubSub.publish('winfut.metrics', JSON.stringify(message)),
    ),
    Stream.runDrain,
    Effect.fork,
  );

  const shutdown = Effect.gen(function* () {
    yield* Effect.log('Shutting down metrics service...');
    yield* Effect.sleep(Duration.seconds(1)); // Give time for in-flight operations
    yield* Queue.shutdown(incomingQueue);
  });

  yield* Effect.never.pipe(Effect.onInterrupt(() => shutdown));
});

BunRuntime.runMain(
  Effect.gen(function* () {
    const redisHost = yield* Config.string('REDIS_HOST');
    const redisPort = yield* Config.number('REDIS_PORT');
    const redisOptions = RedisConnectionOptionsLive({
      url: `redis://${redisHost}:${redisPort}`,
    });

    return yield* pipe(
      Effect.scoped(
        Effect.provide(program, Layer.provide(RedisPubSubLive, redisOptions)),
      ),
      Effect.catchAll((error) => {
        return Effect.log(`🚫 Recovering from error ${error}`);
      }),
      Effect.catchAllCause((cause) => {
        return Effect.logError(
          `💥 Recovering from defect(${cause.toString().split('\n')[0]}) ${JSON.stringify(cause.toJSON(), null, 2)}`,
        );
      }),
    );
  }),
);
