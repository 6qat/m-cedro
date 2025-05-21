import { Config, Context, Data, Effect, Layer, Deferred } from 'effect';
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

const bootstrapRedisPubSubEffect = (
  options?: Parameters<typeof createClient>[0],
) =>
  Effect.gen(function* () {
    const clientPublish = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () =>
          createClient(options)
            .connect()
            .then((r) => {
              console.log('Connected to Redis');
              r.on('error', (e) => {
                console.log('Redis error:', e.message);
                r.quit();
              });
              r.on('end', () => {
                console.log('Connection ended');
              });
              return r;
            }),
        catch: (e) => new RedisError({ cause: e, message: 'Error connecting' }),
      }),
      (client) => Effect.promise(() => client.quit()),
    );

    const clientSubscribe = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () =>
          createClient(options)
            .connect()
            .then((r) => {
              console.log('Connected to Redis');
              r.on('error', (e) => {
                console.log('Redis error:', e.message);
                r.quit();
              });
              r.on('end', () => {
                console.log('Connection ended');
              });

              return r;
            }),
        catch: (e) => new RedisError({ cause: e, message: 'Error connecting' }),
      }),
      (client) => Effect.promise(() => client.quit()),
    );

    // Return the RedisShape interface
    return RedisPubSub.of({
      publish: (channel, message) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () => clientPublish.publish(channel, message),
            catch: (e) =>
              new RedisError({
                cause: e,
                message: 'Syncronous error in `Redis.publish`',
              }),
          });

          return result;
        }),
      subscribe: (channel, handler) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () => clientSubscribe.subscribe(channel, handler),
            catch: (e) =>
              new RedisError({
                cause: e,
                message: 'Syncronous error in `Redis.subscribe`',
              }),
          });

          return result;
        }),
    });
  });

const redisPubSubLayer = (options?: Parameters<typeof createClient>[0]) =>
  Layer.scoped(RedisPubSub, bootstrapRedisPubSubEffect(options));

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
  redisPubSubLayer,
};
