import type { ServerMessage } from "./types";

type Listener = (message: ServerMessage) => void;

const DEFAULT_SERVER_URL = "http://127.0.0.1:8000";

export class SocketClient {
  private _listeners: Listener[];
  private _onClose: (() => void) | null;
  private _serverUrl: string;
  private _socket: WebSocket | null;

  constructor(serverUrl = import.meta.env.VITE_SERVER_URL ?? DEFAULT_SERVER_URL) {
    this._listeners = [];
    this._onClose = null;
    this._serverUrl = serverUrl;
    this._socket = null;
  }

  async create(): Promise<string> {
    const response = await fetch(`${this._serverUrl}/api/v1/rooms`, {
      method: "POST"
    });

    if (!response.ok) {
      throw new Error("Could not create room");
    }

    const body = (await response.json()) as { room_id: string };
    return body.room_id;
  }

  connect(roomId: string): Promise<void> {
    const url = this._serverUrl.replace(/^http/, "ws");
    const socket = new WebSocket(`${url}/api/v1/rooms/${roomId}/ws`);
    this._socket = socket;

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      this._listeners.forEach((listener) => listener(message));
    };

    return new Promise((resolve, reject) => {
      socket.onopen = () => {
        // Only treat closes after a successful open as drops worth reconnecting.
        socket.onclose = () => this._onClose?.();
        resolve();
      };
      socket.onerror = () => reject(new Error("Socket connection failed"));
    });
  }

  join(name: string): void {
    this._send({ type: "join", name });
  }

  resume(token: string): void {
    this._send({ type: "resume", token });
  }

  on(listener: Listener): void {
    this._listeners.push(listener);
  }

  onClose(listener: () => void): void {
    this._onClose = listener;
  }

  place(towerType: string, x: number, y: number): void {
    this._send({ type: "place", tower_type: towerType, x, y });
  }

  ready(): void {
    this._send({ type: "ready" });
  }

  upgrade(towerId: string): void {
    this._send({ type: "upgrade", tower_id: towerId });
  }

  private _send(message: object): void {
    if (this._socket === null || this._socket.readyState !== WebSocket.OPEN) {
      throw new Error("Socket is not connected");
    }

    this._socket.send(JSON.stringify(message));
  }
}

