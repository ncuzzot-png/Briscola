import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { applyAction, initialState } from "../src/engine/game.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, "..");

app.use(express.static(clientRoot));
app.get("/", (req, res) => {
  res.sendFile(path.join(clientRoot, "index.html"));
});

const rooms = new Map();
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoomState() {
  return { ...initialState(), mode: "online" };
}

function touch(room) {
  room.lastSeen = Date.now();
}

function getRoom(code) {
  if (!code) return null;
  return rooms.get(code.toUpperCase()) || null;
}

function broadcastState(room) {
  io.to(room.code).emit("state", room.state);
}

function scheduleResolve(room) {
  if (room.resolveTimer) {
    clearTimeout(room.resolveTimer);
    room.resolveTimer = null;
  }
  if (!room.state.awaitingTrickResolve) return;
  const delay = Number.isFinite(room.state.trickPauseMs) ? room.state.trickPauseMs : 900;
  room.resolveTimer = setTimeout(() => {
    room.state = applyAction(room.state, { type: "RESOLVE_TRICK" });
    room.resolveTimer = null;
    broadcastState(room);
  }, delay);
}

io.on("connection", (socket) => {
  socket.on("room:create", () => {
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();
    const room = {
      code,
      state: createRoomState(),
      players: [socket.id, null],
      createdAt: Date.now(),
      lastSeen: Date.now(),
      resolveTimer: null,
    };
    rooms.set(code, room);
    socket.data.roomCode = code;
    socket.data.playerIndex = 0;
    socket.join(code);
    socket.emit("room:created", { code, playerIndex: 0 });
    socket.emit("state", room.state);
  });

  socket.on("room:join", ({ code }) => {
    const room = getRoom(code);
    if (!room) {
      socket.emit("room:error", "Room not found.");
      return;
    }
    const slotIndex = room.players[0] ? (room.players[1] ? -1 : 1) : 0;
    if (slotIndex === -1) {
      socket.emit("room:error", "Room is full.");
      return;
    }
    room.players[slotIndex] = socket.id;
    touch(room);
    socket.data.roomCode = room.code;
    socket.data.playerIndex = slotIndex;
    socket.join(room.code);
    socket.emit("room:joined", { code: room.code, playerIndex: slotIndex });
    socket.emit("state", room.state);
    if (room.state.phase === "menu") {
      io.to(room.code).emit("room:ready");
    } else {
      io.to(room.code).emit("opponent_reconnected");
    }
  });

  socket.on("game:start", () => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room) return;
    if (room.players[0] !== socket.id) return;
    if (room.resolveTimer) {
      clearTimeout(room.resolveTimer);
      room.resolveTimer = null;
    }
    const seed = Date.now();
    room.state = applyAction(room.state, { type: "START_GAME", seed, mode: "online" });
    touch(room);
    broadcastState(room);
  });

  socket.on("action", (action) => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room) return;
    const player = socket.data.playerIndex;
    if (action?.type !== "PLAY_CARD") return;
    if (!Number.isFinite(action.handIndex)) return;
    const nextState = applyAction(room.state, {
      type: "PLAY_CARD",
      player,
      handIndex: action.handIndex,
    });
    if (nextState === room.state) return;
    room.state = nextState;
    touch(room);
    broadcastState(room);
    scheduleResolve(room);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const room = getRoom(code);
    if (!room) return;
    const index = socket.data.playerIndex;
    if (index === 0 || index === 1) {
      room.players[index] = null;
    }
    const hasPlayers = room.players[0] || room.players[1];
    if (!hasPlayers) {
      if (room.resolveTimer) clearTimeout(room.resolveTimer);
      rooms.delete(room.code);
      return;
    }
    touch(room);
    io.to(room.code).emit("opponent_disconnected");
  });
});

setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, code) => {
    if (now - room.lastSeen > ROOM_TTL_MS) {
      if (room.resolveTimer) clearTimeout(room.resolveTimer);
      rooms.delete(code);
    }
  });
}, 30 * 60 * 1000);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Briscola server running on http://localhost:${port}`);
});
