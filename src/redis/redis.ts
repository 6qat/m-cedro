import { getSystemErrorMap } from 'node:util';
import { Config, Context, Data, Deferred, Effect, Layer } from 'effect';
import { type RedisClientType, createClient } from 'redis';

export class RedisError extends Data.TaggedError('RedisError')<{
  cause: unknown;
  message: string;
}> {}

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

export { RedisPubSub, redisPubSubLayer };
