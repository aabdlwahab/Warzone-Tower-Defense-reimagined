/* WebSocket client for the Warzone multiplayer backend. */

// Same-origin relative URLs so Vite (or your reverse proxy) can forward /api → backend.
const DEFAULT_SERVER = '';

export class Net {
  constructor(serverUrl = import.meta.env?.VITE_SERVER_URL ?? DEFAULT_SERVER) {
    this._url = serverUrl;
    this._socket = null;
    this._handlers = [];
    this._onClose = null;
  }

  async listMaps() {
    const r = await fetch(`${this._url}/api/v1/maps`);
    if (!r.ok) throw new Error(`Server returned ${r.status}`);
    return r.json();
  }

  async getMap(mapId) {
    const r = await fetch(`${this._url}/api/v1/maps/${encodeURIComponent(mapId)}`);
    if (!r.ok) throw new Error(`Server returned ${r.status}`);
    return r.json();
  }

  async saveMap(mapData) {
    const r = await fetch(`${this._url}/api/v1/maps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapData),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.detail ?? `Server returned ${r.status}`);
    }
    return r.json();
  }

  async createRoom(mapId = '') {
    const r = await fetch(`${this._url}/api/v1/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ map_id: mapId }),
    });
    if (!r.ok) throw new Error(`Server returned ${r.status}`);
    return (await r.json()).room_id;
  }

  connect(roomId) {
    const wsBase = this._url.replace(/^http/, 'ws');
    const socket = new WebSocket(`${wsBase}/api/v1/rooms/${roomId}/ws`);
    this._socket = socket;
    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this._handlers.forEach(fn => fn(msg));
      } catch {}
    };
    return new Promise((resolve, reject) => {
      socket.onopen = () => {
        socket.onclose = () => this._onClose?.();
        resolve();
      };
      socket.onerror = () => reject(new Error('Connection failed'));
    });
  }

  on(fn)          { this._handlers.push(fn); }
  onClose(fn)     { this._onClose = fn; }

  join(name)      { this._send({ type: 'join', name }); }
  resume(token)   { this._send({ type: 'resume', token }); }
  ready()         { this._send({ type: 'ready' }); }
  place(kind, x, y) { this._send({ type: 'place', tower_type: kind, x, y }); }
  dispatch(kind, targetTeam = null) { this._send({ type: 'dispatch', unit_type: kind, target_team: targetTeam }); }
  upgrade(id)     { this._send({ type: 'upgrade', tower_id: id }); }
  ping()          { this._send({ type: 'ping' }); }

  get roomId()    { return this._roomId ?? null; }

  _send(msg) {
    if (this._socket?.readyState === WebSocket.OPEN)
      this._socket.send(JSON.stringify(msg));
  }
}
