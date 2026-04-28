import Redis from "ioredis";
import { EventEmitter } from "events";

// In-memory fallback for local development when no REDIS_URL is provided.
const memory = {
  store: new Map(),
  emitter: new EventEmitter(),
  messageHandlers: [],
};

function createMemoryConnection() {
  return {
    get: async (key) => {
      const v = memory.store.get(key);
      return v === undefined ? null : v;
    },
    set: async (key, value) => {
      memory.store.set(key, value);
      return "OK";
    },
    publish: async (channel, message) => {
      memory.emitter.emit(channel, message);
      return 1;
    },
    subscribe: async (channel) => {
      // When subscribed to a channel, forward emitted messages to any registered 'message' handlers
      memory.emitter.on(channel, (msg) => {
        memory.messageHandlers.forEach((h) => {
          try {
            h(channel, msg);
          } catch (e) {
            // swallow handler errors for parity with ioredis behavior
          }
        });
      });
      return;
    },
    on: (event, handler) => {
      if (event === "message") memory.messageHandlers.push(handler);
      else memory.emitter.on(event, handler);
    },
    disconnect: () => {},
  };
}

function createRedisConnection() {
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
  if (!url) {
    console.warn(
      "No REDIS_URL/UPSTASH_REDIS_URL provided — using in-memory fallback.",
    );
    return createMemoryConnection();
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  client.on("connect", () => console.log("Connected to Redis (connect event)"));
  client.on("ready", () => console.log("Connected to Redis (ready)"));
  client.on("error", (err) => console.error("Redis error:", err && err.message ? err.message : err));

  return client;
}

export const redis = createRedisConnection();
export const publisher = createRedisConnection();
export const subscriber = createRedisConnection();
