import { BunRuntime } from '@effect/platform-bun';
import { Effect, Queue, Stream, pipe } from 'effect';
import * as Redis from './redis/redis';
import { parseCedroMessage } from './cedro/cedroParser';

const program = Effect.gen(function* () {
  const incomingQueue = yield* Queue.unbounded<string>();
  yield* Redis.subscribe('winfut', (message: string) => {
    Queue.unsafeOffer(incomingQueue, message);
  });
  const stream = Stream.fromQueue(incomingQueue);
  yield* pipe(
    stream,
    Stream.map(parseCedroMessage),
    Stream.map((msg) => msg.lastTradePrice ?? 0),
    Stream.scan(0, (maxSoFar, price) => (price > maxSoFar ? price : maxSoFar)),
    Stream.tap((currentMax) =>
      Effect.log(`Highest lastTradePrice: ${currentMax}`)
    ),
    Stream.runDrain,
    Effect.fork,
  );
  yield* Effect.never;
});

BunRuntime.runMain(Effect.provide(program, Redis.redisLayer()));
