import { Context, Data, Effect, Layer } from 'effect';
import { createClient } from 'redis';

export class RedisError extends Data.TaggedError('RedisError')<{
  cause: unknown;
  message: string;
}> {}

interface RedisConnectionOptionsShape {
  options?: Parameters<typeof createClient>[0];
}
class RedisConnectionOptions extends Context.Tag('RedisConnectionOptions')<
  RedisConnectionOptions,
  RedisConnectionOptionsShape
>() {}

const redisConnectionOptionsLayer = (
  options?: Parameters<typeof createClient>[0],
) =>
  Layer.succeed(
    RedisConnectionOptions,
    RedisConnectionOptions.of({
      options,
    }),
  );

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

class RedisPubSub extends Context.Tag('RedisPubSub')<
  RedisPubSub,
  RedisPubSubShape
>() {}

interface RedisPersistenceShape {
  setValue: (
    key: string,
    value: string,
  ) => Effect.Effect<void, RedisError, never>;
}

class RedisPersistence extends Context.Tag('RedisPersistence')<
  RedisPersistence,
  RedisPersistenceShape
>() {}

const bootstrapRedisPersistenceEffect = () =>
  Effect.gen(function* () {
    const connectionOptions = yield* RedisConnectionOptions;
    const client = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () =>
          createClient({
            ...connectionOptions.options,
          })
            .connect()
            .then((r) => {
              console.log('Connected to Redis');
              r.on('error', (e) => {
                console.log('Redis error(on error):', e.message);
                r.destroy();
              });
              r.on('end', () => {
                console.log('Connection to Redis ended');
              });
              return r;
            }),
        catch: (e) =>
          new RedisError({
            cause: e,
            message: 'Error while connecting to Redis',
          }),
      }),
      (client) =>
        Effect.sync(() => {
          if (client.isReady) {
            client.quit();
          }
        }),
    );
    return RedisPersistence.of({
      setValue: (key, value) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () => client.set(key, value),
            catch: (e) =>
              new RedisError({
                cause: e,
                message: 'Error in `Redis.setValue`',
              }),
          });

          return result;
        }),
    });
  });

const redisPersistenceLayer = () =>
  Layer.scoped(RedisPersistence, bootstrapRedisPersistenceEffect());

const bootstrapRedisPubSubEffect = (
  options?: Parameters<typeof createClient>[0],
) =>
  Effect.gen(function* () {
    const clientPublish = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () =>
          createClient({
            ...options,
          })
            .connect()
            .then((r) => {
              console.log('Connected to Redis');
              r.on('error', (e) => {
                console.log('Redis error(on error):', e.message);
                r.destroy();
              });
              r.on('end', () => {
                console.log('Connection to Redis ended');
              });
              return r;
            }),
        catch: (e) =>
          new RedisError({
            cause: e,
            message: 'Error while connecting to Redis',
          }),
      }),
      (client) =>
        Effect.sync(() => {
          if (client.isReady) {
            client.quit();
          }
        }),
    );

    const clientSubscribe = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () =>
          createClient({
            ...options,
          })
            .connect()
            .then((r) => {
              console.log('Connected to Redis');
              r.on('error', (e) => {
                console.log('Redis error(on error):', e.message);
                r.destroy();
              });
              r.on('end', () => {
                console.log('Connection to Redis ended');
              });

              return r;
            }),
        catch: (e) =>
          new RedisError({
            cause: e,
            message: 'Error while connecting to Redis',
          }),
      }),
      (client) =>
        Effect.sync(() => {
          if (client.isReady) {
            client.quit();
          }
        }),
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
                message: 'Error in `Redis.publish`',
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
                message: 'Error in `Redis.subscribe`',
              }),
          });

          return result;
        }),
    });
  });

const redisPubSubLayer = (options?: Parameters<typeof createClient>[0]) =>
  Layer.scoped(RedisPubSub, bootstrapRedisPubSubEffect(options));

export {
  RedisPersistence,
  RedisPubSub,
  redisPersistenceLayer,
  redisPubSubLayer,
  RedisConnectionOptions,
  redisConnectionOptionsLayer,
};
