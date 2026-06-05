# Warzone Tower Defense Multiplayer

Online multiplayer tower defense inspired by classic warzone-style defense games.

This project uses original code and should use original names, art, maps, and
audio. The backend is authoritative: clients send player intent, and the Python
server validates and simulates the match.

## Structure

```text
backend/
  app/
    api/       FastAPI and WebSocket boundaries
    domain/    Game state, simulation, validation, and snapshots
    server/    Multiplayer room lifecycle
  tests/       Behavior-focused backend tests

client/
  src/         Browser client scaffold
```

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app.main:app --reload
```

The API exposes:

- `GET /health`
- `POST /api/v1/rooms`
- `WS /api/v1/rooms/{room_id}/ws`

CORS origins default to the local Vite dev/preview ports. Override them in
production with a comma-separated list:

```bash
export WARZONE_ALLOWED_ORIGINS="https://play.example.com"
```

### Realtime protocol & reconnection

The server is authoritative and drives a fixed-timestep simulation, streaming
state to clients ~10×/second. The socket protocol is:

- `join` → server replies `joined` with a `player_id`, a `token`, and a full
  snapshot (including the static `map`).
- `resume` (with a saved `token`) re-attaches a dropped client to its existing
  player; an unknown token yields `resume_failed`.
- Per-tick `snapshot` messages carry only dynamic state (no `map`) plus an
  `events` array (`shot` / `kill` / `leak` / `placed` / `upgraded`) the client
  uses to drive effects.

Disconnected players keep their slot during a short grace window (and keep
their towers once a match is running); idle rooms with no connections are
reaped automatically.

## Client

```bash
cd client
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The client expects the backend on
`http://127.0.0.1:8000`.

## Tests

```bash
python3 -m unittest discover backend/tests
```
