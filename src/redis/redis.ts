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

export class Redis extends Context.Tag('Redis')<Redis, RedisImpl>() {}

export const make = (options?: Parameters<typeof createClient>[0]) =>
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
    return Redis.of({
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

export const layer = (options?: { url?: string }) =>
  Layer.scoped(Redis, make(options));

// Example: Effectful Redis commands
export const set = (key: string, value: string) =>
  Effect.gen(function* () {
    const redis = yield* Redis;
    yield* redis.use((client) => client.set(key, value));
  });

export const get = (key: string) =>
  Effect.gen(function* () {
    const redis = yield* Redis;
    return yield* redis.use((client) => client.get(key));
  });

export const del = (key: string) =>
  Effect.gen(function* () {
    const redis = yield* Redis;
    yield* redis.use((client) => client.del(key));
  });

export const publish = (channel: string, message: string) =>
  Effect.gen(function* () {
    const redis = yield* Redis;
    yield* redis.use((client) => client.publish(channel, message));
  });
