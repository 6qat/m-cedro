# docker build -t ceschiatti/m-cedro:latest .
# docker run --rm --name m-cedro ceschiatti/m-cedro
# docker exec -it m-cedro bash

FROM oven/bun:latest
WORKDIR /app
COPY package.json .
COPY src ./src
RUN bun --frozen-lockfile install
CMD ["bun", "src/dump.ts"]
