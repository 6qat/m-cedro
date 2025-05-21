import { Config, Context, Data, Effect, Layer } from 'effect';
import { getSystemErrorMap } from 'node:util';
import { type RedisClientType, createClient } from 'redis';

export class RedisError extends Data.TaggedError('RedisError')<{
  cause: unknown;
  message: string;
}> {}

interface RedisShape {
  use: <T>(
    fn: (client: ReturnType<typeof createClient>) => T,
  ) => Effect.Effect<Awaited<T>, RedisError, never>;
}

interface RedisPubSubShape {
  publish: (
    channel: string,
    message: string,
  ) => Effect.Effect<void, RedisError, never>;
  subscribe: (
    channel: string,
    handler: (message: string) => void,
  ) => Effect.Effect<void, RedisError, never>;
}

class Redis extends Context.Tag('Redis')<Redis, RedisShape>() {}

class RedisPubSub extends Context.Tag('RedisPubSub')<
  RedisPubSub,
  RedisPubSubShape
>() {}

const bootstrapRedisEffect = (options?: Parameters<typeof createClient>[0]) =>
  Effect.gen(function* () {
    // Try Redis connection within an Effect
    const client = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => createClient(options).connect(),
        catch: (e) => new RedisError({ cause: e, message: 'Error connecting' }),
      }),
      (client) => Effect.promise(() => client.quit()),
    );

    // Return the RedisShape interface
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

const bootstrapRedisPubSubEffect = (
  options?: Parameters<typeof createClient>[0],
) =>
  Effect.gen(function* () {
    // Try Redis connection within an Effect
    const beforePublishConnect = createClient(options);
    beforePublishConnect.on('error', () => {
      console.error('Redis error:');
      process.exit(1);
    });
    const clientPublish = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => beforePublishConnect.connect(),
        catch: (e) => new RedisError({ cause: e, message: 'Error connecting' }),
      }),
      (client) => Effect.promise(() => client.quit()),
    );

    const beforeSubscribeConnect = createClient(options);
    beforeSubscribeConnect.on('error', () => {
      console.error('Redis error:');
      process.exit(1);
    });
    const clientSubscribe = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => beforeSubscribeConnect.connect(),
        catch: (e) => new RedisError({ cause: e, message: 'Error connecting' }),
      }),
      (client) => Effect.promise(() => client.quit()),
    );

    // Return the RedisShape interface
    return RedisPubSub.of({
      publish: (channel, message) =>
        Effect.gen(function* () {
          const result = yield* Effect.try({
            try: () => clientPublish.publish(channel, message),
            catch: (e) =>
              new RedisError({
                cause: e,
                message: 'Syncronous error in `Redis.publish`',
              }),
          });
          if (result instanceof Promise) {
            return yield* Effect.tryPromise({
              try: () => result,
              catch: (e) =>
                new RedisError({
                  cause: e,
                  message: 'Asyncronous error in `Redis.publish`',
                }),
            });
          }
          return result;
        }),
      subscribe: (channel, handler) =>
        Effect.gen(function* () {
          const result = yield* Effect.try({
            try: () => clientSubscribe.subscribe(channel, handler),
            catch: (e) =>
              new RedisError({
                cause: e,
                message: 'Syncronous error in `Redis.subscribe`',
              }),
          });
          if (result instanceof Promise) {
            return yield* Effect.tryPromise({
              try: () => result,
              catch: (e) =>
                new RedisError({
                  cause: e,
                  message: 'Asyncronous error in `Redis.subscribe`',
                }),
            });
          }
          return result;
        }),
    });
  });

const redisLayer = (options?: Parameters<typeof createClient>[0]) =>
  Layer.scoped(Redis, bootstrapRedisEffect(options));

const redisPubSubLayer = (options?: Parameters<typeof createClient>[0]) =>
  Layer.scoped(RedisPubSub, bootstrapRedisPubSubEffect(options));

const fromEnv = Layer.scoped(
  Redis,
  Effect.gen(function* () {
    const url = yield* Config.string('REDIS_URL');
    return yield* bootstrapRedisEffect({ url });
  }),
);

// Example: Effectful Redis commands
const set = (key: string, value: string) =>
  Effect.gen(function* () {
    const redis = yield* Redis;
    yield* redis.use((client) => client.set(key, value));
  });

const get = (key: string) =>
  Effect.gen(function* () {
    const redis = yield* Redis;
    return yield* redis.use((client) => client.get(key));
  });

const del = (key: string) =>
  Effect.gen(function* () {
    const redis = yield* Redis;
    yield* redis.use((client) => client.del(key));
  });

const publish = (channel: string, message: string) =>
  Effect.gen(function* () {
    const redis = yield* Redis;
    yield* redis.use((client) => client.publish(channel, message));
  });

const subscribe = (channel: string, handler: (message: string) => void) =>
  Effect.gen(function* () {
    const redis = yield* Redis;
    yield* redis.use((client) => client.subscribe(channel, handler));
  });

export {
  Redis,
  RedisPubSub,
  set,
  get,
  del,
  publish,
  subscribe,
  redisLayer,
  redisPubSubLayer,
  fromEnv,
};
