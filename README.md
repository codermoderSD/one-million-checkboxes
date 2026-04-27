# 1 Million Checkboxes (Socket.IO Experiment)

This project is a real-time checkbox sync demo built with Express + Socket.IO.

Even though the UI theme says "1 Million Checkboxes", the current implementation renders `100` checkboxes (`CHECKBOX_COUNT = 100`) to validate architecture and behavior first.

## What This Project Demonstrates

- Real-time updates across connected clients using WebSockets (via Socket.IO)
- Server-owned checkbox state for consistency
- Initial state hydration from server to client
- Broadcast model: one client change updates all clients

---

## Tech Stack

- Node.js (ESM)
- Express (HTTP server + static hosting)
- Socket.IO (bi-directional real-time communication)
- Plain HTML/CSS/JS frontend

---

## Current Flow (Step by Step)

### 1. Create the HTTP + Express server

In [index.js](index.js), we create:

- an Express app
- an HTTP server from that app
- a Socket.IO server attached to the same HTTP server

Why this decision:

- We serve static files and WebSocket upgrades from a single process/port, which simplifies local development and deployment.

### 2. Keep checkbox state on the server

In [index.js](index.js), server state is initialized as:

- `const CHECKBOX_COUNT = 100`
- `state.checkboxes = new Array(CHECKBOX_COUNT).fill(false)`

Why this decision:

- The server is the source of truth.
- If each browser maintained its own state independently, clients would drift and show different values.
- Central state allows late joiners to fetch current values and remain in sync.

### 3. Expose REST endpoints for bootstrapping and health

Current endpoints:

- `GET /health` -> `{ healthy: true }`
- `GET /checkboxes` -> `{ checkboxes: [...] }`

Why this decision:

- `/health` helps verify service availability quickly.
- `/checkboxes` allows a fresh client to hydrate UI from current server state before receiving live events.

### 4. Handle WebSocket connection lifecycle

On socket connection in [index.js](index.js):

- log the socket id
- listen for `client:checkbox:change`

When the event arrives:

1. update `state.checkboxes[index]`
2. `io.emit("server:checkbox:change", data)` to all connected clients

Why this decision:

- Broadcast keeps all clients visually aligned in near-real time.
- Updating server state before/with broadcast ensures a durable snapshot for future clients.

### 5. Initialize client socket and subscribe to updates

In [public/index.html](public/index.html):

- load Socket.IO client script from `/socket.io/socket.io.js`
- connect with `const socket = io()`
- subscribe to `server:checkbox:change`

On receiving server event:

- find the corresponding checkbox by id
- apply checked value from payload

Why this decision:

- The client becomes reactive to server events, not isolated local state changes.

### 6. Hydrate initial UI from server state

On window load in [public/index.html](public/index.html):

1. fetch `/checkboxes`
2. create checkbox inputs from response array
3. assign deterministic ids (`checkbox-${index}`)
4. attach `change` listener for each input

When changed, client emits:

- `socket.emit("client:checkbox:change", { index, checked })`

Why this decision:

- Deterministic ids allow fast lookup when socket events arrive.
- Server-state hydration prevents blank/default UI from conflicting with real shared state.

---

## Run Locally

## 1. Install dependencies

```bash
pnpm install
```

## 2. Start server

```bash
node --watch index.js
```

Server runs on:

- `http://localhost:8000`

## 3. Test with multiple tabs

- Open the app in two browser tabs/windows.
- Toggle any checkbox in tab A.
- You should see the same checkbox update in tab B.

---

## Event Contract

Client -> Server:

- `client:checkbox:change`
- payload: `{ index: number, checked: boolean }`

Server -> Clients:

- `server:checkbox:change`
- payload: `{ index: number, checked: boolean }`

---

## Why Server State Matters

If state lives only in the browser:

- each client can diverge
- refresh resets local values
- late joiners cannot get current truth

By keeping state on server:

- one canonical state exists
- all clients can converge on same values
- reconnecting clients can rehydrate from `/checkboxes`

---

## Scaling Problem and Redis Pub/Sub Solution

### Single server limitation

A single WebSocket server can handle many concurrent connections (example: ~1000, depending on infra and workload), but this is still bounded by CPU, memory, and network limits of one machine.

### Horizontal scaling challenge

If you run multiple app servers behind a load balancer:

- client A may connect to server-1
- client B may connect to server-2

Without coordination, server-1 events are not automatically known by server-2, so clients can fall out of sync.

#### Problem architecture (isolated servers)

![Problem Architecture](/public/ws.png)

### Redis Pub/Sub approach

Introduce Redis as a central message broker:

#### Solution architecture (shared broker)

![Solution Architecture](/public/redis.png)

1. A client emits to server-1.
2. Server-1 publishes the event to Redis.
3. All app servers subscribed to that Redis channel receive the message.
4. Each server emits to its own connected clients.

Result:

- cross-instance real-time sync
- horizontal scalability with shared event propagation
- practical path from one-server limits toward much higher aggregate capacity (for example, `N servers * per-server connection capacity`)

In your framing: if one server handles ~1000 connections, then 1000 servers can target roughly `1000 * 1000` aggregate connections, provided infra, state strategy, and backpressure controls are designed correctly.
