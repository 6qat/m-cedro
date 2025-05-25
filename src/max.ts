import { BunRuntime } from '@effect/platform-bun';
import { Clock, Config, Effect, Layer, Queue, Ref, Stream, pipe } from 'effect';
import { parseCedroMessage } from './cedro/cedroParser';
import {
  RedisPubSub,
  redisPubSubLayer,
  redisConnectionOptionsLayer,
} from './redis/redis';

const getIsoWeekString = (date: Date): string => {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.valueOf() - yearStart.valueOf()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const getPeriods = (ms: number) => {
  const date = new Date(ms);
  const day = date.toISOString().slice(0, 10);
  const week = getIsoWeekString(date);
  const month = date.toISOString().slice(0, 7);
  return { day, week, month };
};

const program = Effect.gen(function* () {
  const incomingQueue = yield* Queue.unbounded<string>();
  const redisPubSub = yield* RedisPubSub;
  yield* redisPubSub.subscribe('winfut', (message: string) => {
    Queue.unsafeOffer(incomingQueue, message);
  });
  const stateRef = yield* Ref.make<{
    day: string;
    maxDay: number;
    week: string;
    maxWeek: number;
    month: string;
    maxMonth: number;
  }>({ day: '', maxDay: 0, week: '', maxWeek: 0, month: '', maxMonth: 0 });
  const stream = Stream.fromQueue(incomingQueue);
  yield* pipe(
    stream,
    Stream.map(parseCedroMessage),
    // Stream.tap((msg) => Effect.log(msg)),
    // Stream.filter((msg) => msg.lastTradeDate !== undefined),
    Stream.mapEffect((msg) =>
      Effect.gen(function* () {
        // TODO: solve this
        const _lastTradeDate = msg.lastTradeDate || ''; // the filter above garantees this
        const now = yield* Clock.currentTimeMillis;
        const { day, week, month } = getPeriods(now);
        const state = yield* Ref.get(stateRef);
        const price = msg.lastTradePrice ?? 0;
        const newState = {
          day,
          maxDay: state.day !== day ? price : Math.max(state.maxDay, price),
          week,
          maxWeek: state.week !== week ? price : Math.max(state.maxWeek, price),
          month,
          maxMonth:
            state.month !== month ? price : Math.max(state.maxMonth, price),
        };
        yield* Ref.set(stateRef, newState);
        return newState;
      }),
    ),
    Stream.tap(({ day, maxDay, week, maxWeek, month, maxMonth }) =>
      redisPubSub.publish(
        'max',
        JSON.stringify({ day, maxDay, week, maxWeek, month, maxMonth }),
      ),
    ),
    Stream.runDrain,
    Effect.fork,
  );
  yield* Effect.never;
});

BunRuntime.runMain(
  Effect.gen(function* () {
    const redisHost = yield* Config.string('REDIS_HOST');
    const redisPort = yield* Config.number('REDIS_PORT');
    const redisOptions = redisConnectionOptionsLayer({
      url: `redis://${redisHost}:${redisPort}`,
    });

    return yield* Effect.provide(
      program,
      Layer.provide(redisPubSubLayer, redisOptions),
    );
  }),
);
