import {
  Effect,
  Stream,
  Queue,
  pipe,
  Console,
  Fiber,
  Duration,
  Config,
  Layer,
} from 'effect';
import { BunRuntime } from '@effect/platform-bun';

import { createTcpConnection } from '@6qat/tcp-connection';
import type { TcpConnection } from '@6qat/tcp-connection';
import type { ConnectionConfig } from './connection-config';
import readline from 'node:readline';
import { createClient } from 'redis';

import { Redis, publish, make } from './redis/redis';

// Usage example
const program = Effect.gen(function* () {
  const publisher = createClient();
  yield* Effect.promise(() => publisher.connect());

  const config: ConnectionConfig = {
    host: 'datafeedcd3.cedrotech.com', // Replace with your host
    port: 81, // Replace with your port
    magicToken: yield* Config.string('CEDRO_TOKEN'), // Replace with your magic token
    username: yield* Config.string('CEDRO_USERNAME'), // Replace with your username
    password: yield* Config.string('CEDRO_PASSWORD'), // Replace with your password
    tickers: ['WINM25', 'WDOK25'],
  };

  const connection: TcpConnection = yield* createTcpConnection({
    host: config.host,
    port: config.port,
  });

  // Start reading from the TCP connection
  const readerFiber = yield* pipe(
    connection.stream,
    Stream.tap((data) =>
      Console.log(`Received: ${new TextDecoder().decode(data)}`),
    ),
    Stream.tap((data) => publish('winfut', new TextDecoder().decode(data))),
    Stream.runDrain,
    Effect.fork,
  );

  // Send credentials immediately after connection is established
  yield* connection.sendText(`${config.magicToken}\n`);
  yield* connection.sendText(`${config.username}\n`);
  yield* connection.sendText(`${config.password}\n`);

  // Send SQT command for each ticker
  yield* Effect.sleep(Duration.millis(1500));
  if (config.tickers) {
    for (const ticker of config.tickers) {
      yield* connection.sendText(`sqt ${ticker}\n`);
    }
  }

  const shutdown = async () => {
    // The readline effect loops indefinitely. When we close it,
    // the program will continue, closing the connection and
    // joining the readerFiber.
    rl.close();
  };

  // Handle SIGINT (Ctrl+C) and SIGTERM
  const handleSignal = async () => {
    shutdown();
  };
  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);

  // Setup readline interface for stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // Wrap readline in an Effect for cleanup
  yield* Effect.async((resume, signal) => {
    rl.on('line', (line) => {
      if (line === 'quit') {
        rl.close();
      } else {
        Effect.runPromise(connection.sendText(`${line}\n`));
      }
    });

    rl.on('close', () => {
      resume(Effect.succeed(undefined));
    });

    signal.addEventListener('abort', () => {
      rl.close();
    });
  });

  // When stdin closes, clean up TCP connection
  yield* connection.close;
  yield* Fiber.join(readerFiber);
});

BunRuntime.runMain(
  pipe(
    Effect.scoped(Effect.provide(program, Layer.scoped(Redis, make()))),
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
