import {
  Cause,
  Chunk,
  Context,
  Data,
  Effect,
  Exit,
  Layer,
  Option,
  Queue,
  Stream,
} from 'effect';
import net from 'node:net';

// --- Error Types ---

export type TcpError = ConnectionError | WriteError | ReadError | FramingError;

export class ConnectionError extends Data.TaggedError('ConnectionError')<{
  readonly error?: unknown;
  readonly message: string;
}> {}

export class WriteError extends Data.TaggedError('WriteError')<{
  readonly error?: unknown;
}> {}

export class ReadError extends Data.TaggedError('ReadError')<{
  readonly error?: unknown;
}> {}

export class FramingError extends Data.TaggedError('FramingError')<{
  readonly message: string;
}> {}

// --- Service Definition ---

export interface ConnectionOptions {
  readonly host: string;
  readonly port: number;
}

export interface TcpClientShape {
  readonly send: (data: string) => Effect.Effect<void, WriteError>;
  readonly receive$: Stream.Stream<string, ReadError | FramingError>;
}

class TcpClient extends Context.Tag('@app/TcpClient')<
  TcpClient,
  TcpClientShape
>() {}

// --- Implementation ---

const makeTcpClient = (options: ConnectionOptions) =>
  Effect.gen(function* () {
    // Queue for incoming raw data chunks
    const dataQueue = yield* Effect.acquireRelease(
      Queue.unbounded<Uint8Array>(),
      (q) => Queue.shutdown(q),
    );

    // Queue for signaling connection closure or errors
    const signalQueue = yield* Effect.acquireRelease(
      Queue.unbounded<Exit.Exit<void, ReadError | FramingError>>(),
      (q) => Queue.shutdown(q),
    );

    const acquireSocket = Effect.async<net.Socket, ConnectionError>(
      (resume) => {
        const sock = net.createConnection(options, () => {
          Effect.logDebug('TCP connection established');
          // Remove listeners added during connection phase
          sock.removeAllListeners('error');
          sock.removeAllListeners('close');
          resume(Effect.succeed(sock));
        });

        sock.once('error', (err) => {
          Effect.logError('TCP connection error during connect');
          resume(
            Effect.fail(
              new ConnectionError({
                error: err,
                message: 'Connection error during connect',
              }),
            ),
          );
        });

        // Handle close during connection attempt
        sock.once('close', () => {
          Effect.logInfo('TCP connection closed during connect attempt');
          resume(
            Effect.fail(
              new ConnectionError({
                message: 'Connection closed during connect attempt',
              }),
            ),
          );
        });

        // Ensure cleanup if the effect is interrupted
        return Effect.sync(() => {
          if (!sock.destroyed) {
            sock.destroy();
          }
        });
      },
    );

    const socket = yield* Effect.acquireRelease(acquireSocket, (sock) =>
      Effect.sync(() => {
        Effect.logDebug('Destroying TCP socket');
        if (!sock.destroyed) {
          sock.destroy();
        }
      }),
    );

    socket.on('data', (data) => {
      // Non-backpressured enqueue
      Queue.unsafeOffer(dataQueue, data);
    });

    socket.on('error', (err) => {
      Effect.logError('TCP socket error');
      Queue.unsafeOffer(signalQueue, Exit.fail(new ReadError({ error: err })));
    });

    socket.on('close', (hadError) => {
      Effect.logInfo(`TCP connection closed${hadError ? ' due to error' : ''}`);
      // Signal normal closure if no error event preceded it
      Queue.unsafeOffer(signalQueue, Exit.succeed(undefined));
    });

    // Cleanup listeners on scope finalization
    Effect.addFinalizer(() => {
      Effect.logDebug('Removing TCP socket listeners');
      socket.removeAllListeners('data');
      socket.removeAllListeners('error');
      socket.removeAllListeners('close');
      socket.removeAllListeners('drain'); // Ensure drain listener is removed if added
      return Exit.succeed(undefined);
    });

    const send = (data: string): Effect.Effect<void, WriteError> =>
      Effect.async<void, WriteError>((resume) => {
        const dataToSend = `${data}\n`; // Append newline for framing
        const success = socket.write(dataToSend, 'utf8', (err) => {
          if (err) {
            Effect.logError('TCP write error (callback)');
            resume(Effect.fail(new WriteError({ error: err })));
          } else {
            // Success handled by return value or drain event
          }
        });

        if (success) {
          // Data flushed to kernel buffer immediately
          resume(Effect.void);
        } else {
          // Kernel buffer full, wait for drain
          Effect.logDebug('TCP write buffer full, waiting for drain');
          socket.once('drain', () => {
            Effect.logDebug('TCP write buffer drained');
            resume(Effect.void);
          });
          // Handle error during drain wait
          socket.once('error', (err) => {
            Effect.logError('TCP write error while waiting for drain');
            resume(Effect.fail(new WriteError({ error: err })));
          });
        }

        // Cleanup listeners if effect is interrupted
        return Effect.sync(() => {
          socket.removeAllListeners('drain');
          // Error listener is handled globally, no need to remove here
        });
      });

    function chunkToBuffer(chunk: Chunk.Chunk<Uint8Array | number>): Buffer {
      const arr = Array.from(chunk);
      if (arr.length === 0) return Buffer.alloc(0);
      if (typeof arr[0] === 'number') {
        return Buffer.from(arr as number[]);
      }
      return Buffer.concat(arr as Uint8Array[]);
    }

    const receive$: Stream.Stream<string, ReadError | FramingError> =
      Stream.unwrapScoped(
        Effect.gen(function* (_) {
          let currentBuffer = Buffer.alloc(0);
          const decoder = new TextDecoder('utf-8');

          const dataStream = Stream.fromQueue(dataQueue);
          const signalStream = Stream.fromQueue(signalQueue);

          const framedStream = Stream.mapChunks(dataStream, (chunk) => {
            currentBuffer = Buffer.concat([
              currentBuffer,
              chunkToBuffer(chunk),
            ]);
            const messages: string[] = [];
            const newlineIndex = currentBuffer.indexOf('\n');
            while (newlineIndex !== -1) {
              const messageBuffer = currentBuffer.subarray(0, newlineIndex);
              try {
                const message = decoder.decode(messageBuffer);
                messages.push(message);
              } catch (_e) {
                // Handle potential decoding errors - could fail the stream
                // For now, log and potentially skip
                Effect.logWarning('Failed to decode message chunk');
              }
              currentBuffer = currentBuffer.subarray(newlineIndex + 1);
            }
            return Chunk.fromIterable(messages);
          });

          // Combine data stream with signal stream to handle errors/closure
          const combinedStream = Stream.merge(
            framedStream,
            Stream.flatMap(
              signalStream,
              Exit.match({
                onFailure: (cause) => Stream.failCause(cause),
                onSuccess: () => Stream.empty, // End the stream on clean close
              }),
            ),
          );

          return combinedStream;
        }),
      ).pipe(
        Stream.catchAllCause((cause) => {
          // Ensure framing errors are distinct if needed, otherwise map all to ReadError
          const error = Cause.failureOption(cause);
          if (Option.isSome(error) && error.value instanceof FramingError) {
            return Stream.failCause(cause);
          }
          return Stream.fail(new ReadError({ error: Cause.squash(cause) }));
        }),
      );

    return { send, receive$ };
  });

export const TcpClientLive = (options: ConnectionOptions) =>
  Layer.scoped(TcpClient, makeTcpClient(options));
