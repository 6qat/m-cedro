# docker build -t ceschiatti/market-dashboard:latest .
# docker run --rm -p 3000:3000 --name market-dashboard ceschiatti/market-dashboard
# docker exec -it market-dashboard bash

FROM oven/bun:latest AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN bun --frozen-lockfile install

FROM oven/bun:latest AS production-dependencies-env
COPY ./package.json bun.lock /app/
WORKDIR /app
RUN bun --frozen-lockfile --production install 

FROM oven/bun:latest AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN bun run build

FROM oven/bun:latest
COPY ./package.json bun.lock server.ts /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
ENV NODE_ENV=production
CMD ["bun", "server.ts"]
