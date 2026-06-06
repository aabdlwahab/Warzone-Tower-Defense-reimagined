# Warzone Tower Defense — Multiplayer

A real-time, WWII-themed multiplayer tower defense game. A **server-authoritative**
Python backend runs the entire simulation on a fixed timestep; thin browser
clients send player intent and render interpolated snapshots streamed over
WebSockets.

- **Single-player** — survive 10 escalating AI waves on your own map.
- **PvP** — 2 or 4 players each defend an HQ and spend income to *dispatch*
  enemy squads at their opponents. Last base standing wins.

> The server validates and simulates every action. Clients never decide
> outcomes — they only draw what the server reports, which keeps the game
> cheat-resistant and every client perfectly in sync.

---

## Table of contents

- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Backend design](#backend-design)
- [The simulation tick](#the-simulation-tick)
- [Realtime protocol](#realtime-protocol)
- [Match lifecycle](#match-lifecycle)
- [Pathfinding](#pathfinding)
- [Maps & the in-browser designer](#maps--the-in-browser-designer)
- [Getting started](#getting-started)
- [Tests](#tests)
- [Tech stack](#tech-stack)

---

## Architecture

The browser never runs game logic. It opens one WebSocket per room, sends
intent (`place`, `dispatch`, `ready`, …), and renders the snapshots the server
broadcasts ~10×/second. In development, Vite proxies `/api` (HTTP **and** WS) to
the backend, so the client is effectively same-origin.

```mermaid
flowchart LR
    subgraph Browser["Browser client (Phaser 3)"]
        Lobby["Lobby + Map Designer<br/>main.js / designer.js"]
        Game["Game scene<br/>render + interpolation"]
        Hud["HUD scene<br/>palette / controls"]
        Net["Net (WebSocket)<br/>net.js"]
        Lobby --> Net
        Game --> Net
        Hud --> Net
    end

    subgraph Server["FastAPI backend"]
        API["HTTP + WS boundary<br/>main.py / sockets.py"]
        Rooms["Room manager<br/>fixed-timestep loop"]
        Domain["Domain simulation<br/>services / systems / stores"]
        Maps[("Map files<br/>app/maps/*.json")]
        API --> Rooms --> Domain
        Domain --> Maps
    end

    Net <-->|"WS: intent up / snapshots down"| API

    style Browser fill:#15161d,stroke:#33384a,color:#e9e6da
    style Server fill:#11150f,stroke:#3d8c40,color:#e9e6da
```

**Intent up, state down.** A client message is applied under a per-room lock,
the resulting state is broadcast to everyone, and a separate fixed-timestep loop
keeps advancing the simulation between inputs.

---

## Repository layout

```text
.
├── backend/
│   ├── app/
│   │   ├── api/          HTTP schemas + WebSocket handler (FastAPI boundary)
│   │   ├── domain/       Pure game logic — no framework imports
│   │   │   ├── models.py      Dataclasses: Tile, Enemy, Tower, MapDefinition…
│   │   │   ├── catalogs.py    Static balance data + map loading
│   │   │   ├── stores.py      Mutable per-match state containers
│   │   │   ├── systems.py     Spawning, movement, separation, combat
│   │   │   ├── pathing.py     Nondeterministic Dijkstra navigation
│   │   │   ├── validators.py  Command pre-conditions
│   │   │   ├── services.py    GameService — orchestrates a single match
│   │   │   └── snapshots.py   Domain state → client-safe JSON
│   │   ├── server/       Room lifecycle, broadcasting, map persistence
│   │   └── maps/         Built-in + designer-saved map JSON
│   └── tests/            Behavior-focused unit tests
│
└── client/              Phaser 3 front-end (Vite)
    ├── src/
    │   ├── main.js        Lobby, map-select, Phaser bootstrap
    │   ├── config.js      Presentation data (palette, tooltip stats)
    │   ├── net.js         WebSocket client
    │   ├── map.js         Paints the static map layer into a scene
    │   ├── designer.js    In-browser map editor
    │   └── scenes/        Boot (preload) · Game (render) · Hud (controls)
    └── public/
        ├── assets/        Sprites + manifest.json
        └── maps/          Client copies of map JSON (previews)
```

The **domain** package is deliberately framework-free: it imports no FastAPI and
no asyncio, so the whole game is testable as plain Python and the network layer
is a thin shell around it.

---

## Backend design

Layers depend strictly inward — the API knows about the domain, but the domain
knows nothing about the web.

```mermaid
flowchart TD
    main["main.py<br/>(FastAPI app + routes)"]
    sockets["api/sockets.py<br/>(WS handler + rate limit)"]
    rooms["server/rooms.py<br/>(Room: fixed-timestep loop,<br/>reconnection, broadcast)"]
    mapsvc["server/maps.py<br/>(map file persistence)"]
    service["domain/services.py<br/>(GameService + GameFactory)"]
    systems["domain/systems.py<br/>(WaveSpawner · DispatchSystem<br/>EnemyMover · CombatSystem)"]
    stores["domain/stores.py<br/>(GameStore + sub-stores)"]
    pathing["domain/pathing.py<br/>(Navigator)"]
    catalogs["domain/catalogs.py<br/>(towers / enemies / waves / maps)"]
    models["domain/models.py<br/>(dataclasses)"]

    main --> sockets --> rooms --> service
    main --> mapsvc --> catalogs
    service --> systems --> stores --> pathing
    service --> stores
    systems --> catalogs
    stores --> models
    catalogs --> models

    style main fill:#1c2333,stroke:#4a5060,color:#e9e6da
    style sockets fill:#1c2333,stroke:#4a5060,color:#e9e6da
    style rooms fill:#1c2333,stroke:#4a5060,color:#e9e6da
    style mapsvc fill:#1c2333,stroke:#4a5060,color:#e9e6da
    style service fill:#132414,stroke:#3d8c40,color:#e9e6da
    style systems fill:#132414,stroke:#3d8c40,color:#e9e6da
    style stores fill:#132414,stroke:#3d8c40,color:#e9e6da
    style pathing fill:#132414,stroke:#3d8c40,color:#e9e6da
    style catalogs fill:#132414,stroke:#3d8c40,color:#e9e6da
    style models fill:#132414,stroke:#3d8c40,color:#e9e6da
```

A `Room` owns one `GameService` and an `asyncio` loop. The loop sleeps in fixed
`SIM_SECONDS` (50 ms) slices, accumulates real elapsed time, and advances the
simulation in whole steps so **play speed never depends on event-loop jitter**.
Snapshots are throttled to `BROADCAST_SECONDS` (100 ms).

---

## The simulation tick

Every step runs the same ordered pipeline. Nothing happens unless the match is
`RUNNING`.

```mermaid
flowchart TD
    A["tick(dt)"] --> B{status == RUNNING?}
    B -->|no| Z["return snapshot"]
    B -->|yes| C["advance build-phase<br/>countdown (prep timer)"]
    C --> D["WaveSpawner<br/>spawn AI wave units"]
    D --> E["DispatchQueue tick<br/>+ drain ready PvP squads"]
    E --> F["CombatSystem<br/>towers acquire & fire"]
    F --> G["EnemyMover<br/>advance along paths"]
    G --> H["separation pass<br/>queue units, no overlap"]
    H --> I["PvP passive income"]
    I --> J["settle<br/>eliminate dead bases,<br/>resolve win/lose,<br/>schedule next wave"]
    J --> Z

    style A fill:#2b2818,stroke:#ffcf3f,color:#e9e6da
    style Z fill:#132414,stroke:#3d8c40,color:#e9e6da
```

**Movement & separation.** Units always advance freely along a per-tile path;
a second pass then nudges the *rear* unit of any overlapping pair backward so
columns form a tidy single-file queue. Because the column leader is never
pushed, the system **cannot deadlock** — crowds resolve instead of freezing.

---

## Realtime protocol

The socket is authoritative and reconnection-friendly. A dropped client keeps
its slot (and its towers, once a match is running) during a grace window and can
re-attach with a saved token.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant R as Room (server)
    participant G as GameService

    C->>R: join { name }
    R->>G: join()
    G-->>R: player + full snapshot
    R-->>C: joined { player_id, token, payload }
    R-->>C: snapshot (broadcast to all)

    loop every BROADCAST_SECONDS (~100 ms)
        R-->>C: snapshot { payload, events[] }
        Note over C: interpolate positions,<br/>play shot/kill/leak FX
    end

    C->>R: place / dispatch / upgrade / ready
    R->>G: apply(command) under lock
    G-->>R: mutated state
    R-->>C: snapshot (broadcast)

    Note over C,R: -- connection drops --
    C->>R: resume { token }
    alt token known
        R-->>C: resumed { player_id, payload }
    else unknown
        R-->>C: resume_failed
    end
```

**Client → server:** `join` · `resume` · `ready` · `place` · `dispatch` ·
`upgrade` · `ping`
**Server → client:** `joined` · `resumed` · `resume_failed` · `snapshot` ·
`error` · `pong`

Per-tick `snapshot` messages carry only **dynamic** state (the static `map` is
sent once on `join`/`resume`) plus an `events[]` array the client replays for
effects: `shot` · `kill` · `leak` · `placed` · `upgraded` · `dispatched` ·
`unit_upgraded` · `eliminated`.

Each connection is protected by a leaky-bucket rate limiter sized for brisk
human play.

---

## Match lifecycle

```mermaid
stateDiagram-v2
    [*] --> WAITING

    WAITING --> RUNNING: single-player join<br/>(auto-start + build phase)
    WAITING --> RUNNING: PvP — every base has<br/>a ready player

    RUNNING --> VICTORY: solo — all 10 waves cleared
    RUNNING --> DEFEAT: solo — base destroyed
    RUNNING --> FINISHED: PvP — one base remains<br/>or waves exhausted

    VICTORY --> [*]
    DEFEAT --> [*]
    FINISHED --> [*]
```

A single-player map starts the instant a player joins (no lobby). A PvP match
**will not start with a lone player** — it waits until every base has a ready
defender, then starts automatically.

---

## Pathfinding

Enemies do not follow scripted lanes. When the tower layout changes, the
`Navigator` runs **one backward Dijkstra per active team** from that team's base,
producing a cost-to-goal field for every walkable tile. The cost of a tile rises
with the tower DPS that covers it, so heavily-defended ground is naturally
avoided.

At every tile arrival a unit re-decides its next step:

```mermaid
flowchart LR
    A["arrive at tile"] --> B["look up cost-to-goal<br/>of each walkable neighbor"]
    B --> C["keep only neighbors that<br/>make progress (closer to goal)"]
    C --> D["softmax over<br/>cost + threat"]
    D --> E["sample one neighbor"]
    E --> F["walk toward it"]
    F --> A

    style A fill:#2b2818,stroke:#ffcf3f,color:#e9e6da
```

Because the choice is *probabilistic* (softmax temperature `0.5`), equidistant
routes split traffic at real junctions while sharply-worse detours get
near-zero weight. The result: units fan out across the map and take genuinely
different routes each run, with no backtracking and no fixed lane to exploit.

Placement is validated against a connectivity check (`is_reachable`), so a tower
can never fully wall off a spawn from its target base.

---

## Maps & the in-browser designer

Maps are plain JSON (`backend/app/maps/*.json`): grid size, base/spawn
positions, water, decorations, and optional road art. The loader derives the
buildable tile set automatically.

| Map | Mode | Players |
|-----|------|--------:|
| `bocage_run` | single | 1 |
| `river_crossing` | single | 1 |
| `hedgerow_maze` | single | 1 |
| `twin_fronts` | pvp | 2 |
| `crossroads` | pvp | 2 |
| `four_corners` | pvp | 4 |

The lobby includes a **map designer** (`client/src/designer.js`): paint roads,
water, obstacles, HQs and spawns on a grid, then **Save** — the backend
validates the layout, derives lanes, and writes a new `custom_*.json` that
appears in the map list immediately.

---

## Getting started

### Prerequisites

- Python ≥ 3.10
- Node ≥ 18

### 1. Backend (run from the repo root)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

uvicorn backend.app.main:app --reload --port 8000
```

The API exposes:

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/health` | Liveness probe |
| `GET`  | `/api/v1/maps` | List playable maps |
| `GET`  | `/api/v1/maps/{id}` | Full map JSON |
| `POST` | `/api/v1/maps` | Save a designer map |
| `POST` | `/api/v1/rooms` | Create a room for a chosen map |
| `WS`   | `/api/v1/rooms/{id}/ws` | Join and play |

CORS origins default to the local Vite ports; override in production:

```bash
export WARZONE_ALLOWED_ORIGINS="https://play.example.com"
```

### 2. Client

```bash
cd client
npm install
npm run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5173`). Vite proxies `/api`
(HTTP + WebSocket) to the backend on port 8000, so no extra configuration is
needed — just have both running.

To create a shareable PvP match: pick a PvP map, **Create Room**, share the room
code shown in the top-right, and have the second player paste it into the
*Room ID* field.

---

## Tests

The domain is plain Python, so the behavior suite runs fast with no server:

```bash
python3 -m pytest                                       # full suite
python3 -m pytest backend/tests/test_game_service.py    # game rules only
```

Coverage spans match start gating, dispatch economics and squad upgrades,
combat rewards, PvP income, reconnection/room reaping, enemy spacing &
leak-on-contact, and map-file persistence.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Backend | Python · FastAPI · Pydantic · asyncio · `uvicorn` |
| Simulation | Pure-Python domain (dataclasses, `heapq` Dijkstra) |
| Client | Phaser 3 · Vite · vanilla ES modules |
| Transport | WebSocket (JSON) + REST for room/map management |

All code, art, maps, and names are original.
