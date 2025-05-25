import { BunRuntime } from '@effect/platform-bun';
import { Config, Effect, Layer, Queue, Stream, pipe } from 'effect';
import {
  redisConnectionOptionsLayer,
  RedisPubSub,
  redisPubSubLayer,
} from './redis/redis';

const program = Effect.gen(function* () {
  const incomingQueue = yield* Queue.unbounded<string>();
  const redisPubSub = yield* RedisPubSub;
  yield* redisPubSub.subscribe('raw', (message: string) => {
    Queue.unsafeOffer(incomingQueue, message);
  });
  const stream = Stream.fromQueue(incomingQueue);
  yield* pipe(
    stream,
    Stream.filter((message) => message.startsWith('T:WIN')),
    Stream.tap((message) => redisPubSub.publish('winfut', message)),
    Stream.runDrain,
    Effect.fork,
  );
  yield* Effect.never;
});

BunRuntime.runMain(
  Effect.gen(function* () {
    const redisHost = yield* Config.string('REDIS_HOST');
    const redisPort = yield* Config.number('REDIS_PORT');
    return yield* pipe(
      Effect.scoped(
        Effect.provide(
          program,
          Layer.provide(
            redisPubSubLayer(),
            redisConnectionOptionsLayer({
              url: `redis://${redisHost}:${redisPort}`,
            }),
          ),
        ),
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
