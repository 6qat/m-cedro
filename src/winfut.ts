import { BunRuntime } from '@effect/platform-bun';
import { Effect, Queue, Stream, pipe } from 'effect';
import { RedisPubSub, redisPubSubLayer } from './redis/redis';

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
  pipe(
    Effect.scoped(
      Effect.provide(program, redisPubSubLayer({ url: 'redis://redis:6379' })),
    ),
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
