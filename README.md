# bun-tcp

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

to build:

```bash
bun build ./index.ts --outfile index
```

To cross compile for linux:

```bash
bun build --compile --target=bun-linux-x64 ./index.ts --outfile index
```

This project was created using `bun init` in bun v1.2.5. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
