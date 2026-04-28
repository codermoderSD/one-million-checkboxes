import http from "node:http";
import path from "node:path";

import express from "express";
import { Server } from "socket.io";
import { publisher, subscriber, redis } from "./redis-connection.js";

const CHECKBOX_COUNT = 100;
const CHECKBOX_STATE_KEY = "checkbox-state";

async function getCheckboxDataFromRedis(key) {
  const existingState = await redis.get(key);
  if (existingState) {
    const data = JSON.parse(existingState);
    return data;
  } else {
    return new Array(CHECKBOX_COUNT).fill(false);
  }
}

async function main() {
  const PORT = process.env.PORT || 8000;

  const app = express();
  const server = http.createServer(app);

  const io = new Server();
  io.attach(server);

  await subscriber.subscribe("internal-server:checkbox:change");
  subscriber.on("message", (channel, message) => {
    if (channel == "internal-server:checkbox:change") {
      const { index, checked } = JSON.parse(message);
      io.emit("server:checkbox:change", { index, checked });
    }
  });

  // Socket IO Handler
  io.on("connection", (socket) => {
    console.log("socket connected", { socket: socket.id });

    socket.on("client:checkbox:change", async (data) => {
      console.log(`[Socket:${socket.id}]`, data);
      const redisState = await getCheckboxDataFromRedis(CHECKBOX_STATE_KEY);
      redisState[data.index] = data.checked;
      await redis.set(CHECKBOX_STATE_KEY, JSON.stringify(redisState));
      await publisher.publish(
        "internal-server:checkbox:change",
        JSON.stringify(data),
      );
    });
  });

  // Express Handlers
  app.use(express.static(path.resolve("./public")));

  app.get("/health", (req, res) => res.json({ healthy: true }));

  app.get("/checkboxes", async (req, res) => {
    const redisState = await getCheckboxDataFromRedis(CHECKBOX_STATE_KEY);
    return res.json({ checkboxes: redisState });
  });

  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

main();
