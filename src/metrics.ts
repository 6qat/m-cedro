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

  // (1) collect messages for ≤5 s OR ≤1 M items
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

  yield* pipe(
    windowedStream,
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
