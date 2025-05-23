import { BunRuntime } from '@effect/platform-bun';
import { Context, Data, Effect, Layer, Queue, Runtime } from 'effect';
import { type RedisClientType, createClient } from 'redis';

export class RedisError extends Data.TaggedError('RedisError')<{
  cause: unknown;
  message: string;
}> {}

export class Redis extends Context.Tag('Redis')<
  Redis,
  {
    client: RedisClientType;
    errors: Queue.Queue<RedisError>;
    runtime: Runtime.Runtime<never>; // Required for permanent handler
  }
>() {}

const makeScopedRedis = (options?: Parameters<typeof createClient>[0]) =>
  Effect.gen(function* () {
    const client = createClient(options) as RedisClientType;
    const errors = yield* Queue.unbounded<RedisError>();
    const runtime = yield* Effect.runtime<never>();

    // Permanent handler (never unregistered)
    const handler = (err: Error) => {
      Runtime.runPromise(runtime)(
        Queue.offer(
          errors,
          new RedisError({
            message: 'Connection error',
            cause: err,
          }),
        ),
      ).catch(() => void 0); // Ignore if runtime is dead
    };
    client.on('error', handler);

    yield* Effect.tryPromise({
      try: () => client.connect(),
      catch: (error) =>
        new RedisError({ message: 'Connection failed', cause: error }),
    });

    // Finalizer ONLY disconnects (keeps handler alive)
    const finalizer = Effect.addFinalizer(() =>
      Effect.tryPromise({
        try: () => client.quit(),
        catch: () => new Error('bla'),
      }).pipe(Effect.orElse(() => Effect.succeed(''))),
    );
    yield* finalizer;

    return { client, errors, runtime }; // Runtime must be returned to keep alive
  });

export const RedisLive = Layer.scoped(Redis, makeScopedRedis());

export const get = (
  key: string,
): Effect.Effect<string | null, RedisError, Redis> =>
  Effect.gen(function* () {
    const { client, errors } = yield* Redis;

    // Check for any pending errors
    const maybeError = yield* Queue.poll(errors);
    if (maybeError._tag === 'Some') {
      return yield* Effect.fail(maybeError.value);
    }

    // If no errors, proceed with the get operation
    return yield* Effect.tryPromise({
      try: () => client.get(key),
      catch: (error) =>
        new RedisError({
          message: 'GET failed',
          cause: error,
        }),
    });
  });

const program = get('some-key').pipe(Effect.provide(RedisLive));

BunRuntime.runMain(program);
