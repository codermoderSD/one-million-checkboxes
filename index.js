import http from "node:http";
import path from "node:path";

import express from "express";
import { Server } from "socket.io";

const CHECKBOX_COUNT = 100;

const state = {
  checkboxes: new Array(CHECKBOX_COUNT).fill(false),
};

async function main() {
  const PORT = process.env.PORT || 8000;

  const app = express();
  const server = http.createServer(app);

  const io = new Server();
  io.attach(server);

  // Socket IO Handler
  io.on("connection", (socket) => {
    console.log("socket connected", { socket: socket.id });

    socket.on("client:checkbox:change", (data) => {
      console.log(`[Socket:${socket.id}]`, data);
      io.emit("server:checkbox:change", data);
      state.checkboxes[data.index] = data.checked;
    });
  });

  // Express Handlers
  app.use(express.static(path.resolve("./public")));

  app.get("/health", (req, res) => res.json({ healthy: true }));

  app.get("/checkboxes", (req, res) =>
    res.json({ checkboxes: state.checkboxes }),
  );

  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

main();
