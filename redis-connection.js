import Redis from "ioredis";

function createRedisConnection() {
  return new Redis({
    host: "localhost",
    port: 6379,
  });
}

export const redis = createRedisConnection("client");
export const publisher = createRedisConnection("publisher");
export const subscriber = createRedisConnection("subscriber");
