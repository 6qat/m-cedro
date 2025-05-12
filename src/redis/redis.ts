import { Config, Context, Data, Effect, Layer } from 'effect';
import { type RedisClientType, createClient } from 'redis';

export class RedisError extends Data.TaggedError('RedisError')<{
  cause: unknown;
  message: string;
}> {}

interface RedisImpl {
  use: <T>(
    fn: (client: ReturnType<typeof createClient>) => T,
  ) => Effect.Effect<Awaited<T>, RedisError, never>;
}

class RedisTag extends Context.Tag('Redis')<RedisTag, RedisImpl>() {}

const make = (options?: Parameters<typeof createClient>[0]) =>
  Effect.gen(function* () {
    // Try Redis connection within an Effect
    const client = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => createClient(options).connect(),
        catch: (e) => new RedisError({ cause: e, message: 'Error connecting' }),
      }),
      (client) => Effect.promise(() => client.quit()),
    );

    // Return the RedisImpl interface
    return RedisTag.of({
      use: (fn) =>
        Effect.gen(function* () {
          const result = yield* Effect.try({
            try: () => fn(client),
            catch: (e) =>
              new RedisError({
                cause: e,
                message: 'Syncronous error in `Redis.use`',
              }),
          });
          if (result instanceof Promise) {
            return yield* Effect.tryPromise({
              try: () => result,
              catch: (e) =>
                new RedisError({
                  cause: e,
                  message: 'Asyncronous error in `Redis.use`',
                }),
            });
          }
          return result;
        }),
    });
  });

const layer = (options?: Parameters<typeof createClient>[0]) =>
  Layer.scoped(RedisTag, make(options));

const fromEnv = Layer.scoped(
  RedisTag,
  Effect.gen(function* () {
    const url = yield* Config.string('REDIS_URL');
    return yield* make({ url });
  }),
);

// Example: Effectful Redis commands
const set = (key: string, value: string) =>
  Effect.gen(function* () {
    const redis = yield* RedisTag;
    yield* redis.use((client) => client.set(key, value));
  });

const get = (key: string) =>
  Effect.gen(function* () {
    const redis = yield* RedisTag;
    return yield* redis.use((client) => client.get(key));
  });

const del = (key: string) =>
  Effect.gen(function* () {
    const redis = yield* RedisTag;
    yield* redis.use((client) => client.del(key));
  });

const publish = (channel: string, message: string) =>
  Effect.gen(function* () {
    const redis = yield* RedisTag;
    yield* redis.use((client) => client.publish(channel, message));
  });

export const Redis = { set, get, del, publish, layer, fromEnv };
