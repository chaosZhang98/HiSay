import type { WebSocket } from "ws";

interface ConnectionState {
  ws: WebSocket;
  deviceId: string;
  lastPingAt: number;
  lastPongAt: number;
  missedPongs: number;
}

export class ConnectionManager {
  private connections = new Map<string, ConnectionState>();
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly pingIntervalMs = 30_000,
    private readonly maxMissedPongs = 2,
  ) {}

  register(deviceId: string, ws: WebSocket) {
    const existing = this.connections.get(deviceId);
    if (existing) {
      existing.ws.terminate();
    }

    const state: ConnectionState = {
      ws,
      deviceId,
      lastPingAt: 0,
      lastPongAt: Date.now(),
      missedPongs: 0,
    };

    ws.on("pong", () => {
      const current = this.connections.get(deviceId);
      if (current) {
        current.lastPongAt = Date.now();
        current.missedPongs = 0;
      }
    });

    this.connections.set(deviceId, state);
  }

  unregister(deviceId: string) {
    this.connections.delete(deviceId);
  }

  sendToDevice(deviceId: string, message: unknown): boolean {
    const state = this.connections.get(deviceId);
    if (!state) return false;
    if (state.ws.readyState !== 1) return false;

    state.ws.send(JSON.stringify(message));
    return true;
  }

  broadcast(message: unknown) {
    for (const state of [...this.connections.values()]) {
      if (state.ws.readyState === 1) {
        state.ws.send(JSON.stringify(message));
      }
    }
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const state of [...this.connections.values()]) {
        if (state.missedPongs >= this.maxMissedPongs) {
          state.ws.terminate();
          this.connections.delete(state.deviceId);
          continue;
        }

        if (state.lastPongAt < state.lastPingAt) {
          state.missedPongs++;
        }

        state.lastPingAt = now;
        state.ws.ping();
      }
    }, this.pingIntervalMs);
  }

  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    for (const state of [...this.connections.values()]) {
      state.ws.terminate();
    }
    this.connections.clear();
  }
}
