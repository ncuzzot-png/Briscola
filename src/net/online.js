let socket = null;
let isHost = false;
let roomCode = null;
let myPlayerIndex = null;
let handlers = { onState: null, onStatus: null };

function getServerUrl() {
  if (window.BRISCOLA_SERVER_URL) return window.BRISCOLA_SERVER_URL;
  const params = new URLSearchParams(window.location.search);
  const fromParam = params.get("server");
  if (fromParam) return fromParam;
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

function loadSocketIo(serverUrl) {
  if (window.io) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${serverUrl}/socket.io/socket.io.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load socket.io client"));
    document.head.appendChild(script);
  });
}

async function ensureSocket() {
  if (socket) return socket;
  const serverUrl = getServerUrl();
  await loadSocketIo(serverUrl);
  socket = window.io(serverUrl, { transports: ["websocket"] });

  socket.on("state", (state) => {
    if (handlers.onState) handlers.onState(state);
  });

  socket.on("room:created", (payload) => {
    isHost = true;
    roomCode = payload.code;
    myPlayerIndex = payload.playerIndex;
    if (handlers.onStatus) {
      handlers.onStatus({
        status: "waiting",
        roomCode,
        myPlayerIndex,
        isHost,
        error: null,
      });
    }
  });

  socket.on("room:joined", (payload) => {
    roomCode = payload.code;
    myPlayerIndex = payload.playerIndex;
    if (handlers.onStatus) {
      handlers.onStatus({
        status: "waiting",
        roomCode,
        myPlayerIndex,
        isHost,
        error: null,
      });
    }
  });

  socket.on("room:ready", () => {
    if (isHost) {
      socket.emit("game:start");
    }
  });

  socket.on("room:error", (message) => {
    if (handlers.onStatus) {
      handlers.onStatus({ status: "error", error: message || "Room error" });
    }
  });

  socket.on("room:closed", (message) => {
    if (handlers.onStatus) {
      handlers.onStatus({ status: "closed", error: message || "Room closed" });
    }
  });

  socket.on("opponent_disconnected", () => {
    if (handlers.onStatus) {
      handlers.onStatus({ opponentDisconnected: true, status: "opponent_disconnected" });
    }
  });

  socket.on("opponent_reconnected", () => {
    if (handlers.onStatus) {
      handlers.onStatus({ opponentDisconnected: false, status: "connected" });
    }
  });

  return socket;
}

export function setOnlineHandlers({ onState, onStatus }) {
  handlers = { onState, onStatus };
}

export async function hostRoom() {
  if (handlers.onStatus) handlers.onStatus({ status: "connecting", error: null });
  const sock = await ensureSocket();
  isHost = true;
  sock.emit("room:create");
}

export async function joinRoom(code) {
  if (handlers.onStatus) handlers.onStatus({ status: "connecting", error: null });
  const sock = await ensureSocket();
  isHost = false;
  sock.emit("room:join", { code });
}

export function sendAction(action) {
  if (!socket) return;
  socket.emit("action", action);
}

export function getOnlineMeta() {
  return { roomCode, myPlayerIndex, isHost };
}

export function disconnectOnline() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
  isHost = false;
  roomCode = null;
  myPlayerIndex = null;
}
