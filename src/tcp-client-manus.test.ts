import { Effect, type Stream } from 'effect';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type ConnectionOptions, makeTcpClient } from './tcp-client-manus';
// Helper to run Effect and collect stream output
async function collectStream<T, E>(
  stream: Stream.Stream<T, E>,
  take: number,
  timeoutMs = 2000,
): Promise<T[]> {
  return [];
}

describe('TcpClient', () => {
  let server: net.Server;
  let port: number;

  beforeAll(async () => {
    server = net.createServer((socket) => {
      console.log('Client connected to test server');
      socket.on('data', (data) => {
        console.log('Test server received:', data.toString());
        socket.write(data); // Echo back
      });
      socket.on('error', (err) => {
        console.error('Test server socket error:', err);
      });
    });

    server.on('error', (err) => {
      console.error('Test server error:', err);
    });

    return new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as net.AddressInfo).port;
        console.log('Test server listening on port', port);
        resolve();
      });
    });
  });

  afterAll(async () => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should send and receive messages (echo)', async () => {
    const options: ConnectionOptions = { host: '127.0.0.1', port };

    const effect = Effect.gen(function* () {
      const client = yield* makeTcpClient(options);

      try {
        // Send a message
        yield* client.send('hello world');
        console.log('Message sent, waiting for response...');

        // Collect the echoed message with timeout protection
        const received = yield* Effect.tryPromise({
          try: () => collectStream(client.receive$, 1, 3000),
          catch: (error) => {
            console.error('Error in collectStream:', error);
            return new Error(
              `Failed to collect stream: ${error instanceof Error ? error.message : String(error)}`,
            );
          },
        });

        console.log('Received response:', received);
        expect(received[0]).toBe('hello world');
      } catch (error) {
        console.error('Error in test:', error);
        throw error;
      }
    }).pipe(Effect.scoped);

    await expect(Effect.runPromise(effect)).resolves.toBeUndefined();
  });

  it('should handle connection errors', async () => {
    const badOptions: ConnectionOptions = { host: '127.0.0.1', port: 65535 }; // Unused port

    // For error cases, we don't need to scope the effect as we expect it to fail
    await expect(
      Effect.runPromise(makeTcpClient(badOptions).pipe(Effect.scoped)),
    ).rejects.toThrow();
  });

  // Add more tests for framing, error propagation, etc.
});
