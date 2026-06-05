import Phaser from "phaser";

import { AssetCatalog } from "./assets";
import { SocketClient } from "./net";
import { BattleScene, TILE_SIZE } from "./scene";
import type { ServerMessage, Snapshot } from "./types";
import "./styles.css";

const client = new SocketClient();
const status = document.querySelector<HTMLOutputElement>("#status");
const nameInput = document.querySelector<HTMLInputElement>("#name");
const roomInput = document.querySelector<HTMLInputElement>("#room");
const createButton = document.querySelector<HTMLButtonElement>("#create");
const joinButton = document.querySelector<HTMLButtonElement>("#join");
const readyButton = document.querySelector<HTMLButtonElement>("#ready");
const towerButtons = document.querySelectorAll<HTMLButtonElement>(".tower");
let scene: BattleScene | null = null;
let playerId: string | null = null;
let token: string | null = null;
let roomId: string | null = null;
let reconnecting = false;

execute();

async function connect(code: string): Promise<void> {
  if (!code) {
    setStatus("Room code required");
    return;
  }

  roomId = code;
  setStatus(`Connecting to ${code}`);
  await client.connect(code);
  client.join(getName());
}

async function execute(): Promise<void> {
  try {
    const assets = await AssetCatalog.load();
    scene = new BattleScene(assets);
    build(scene);
    bind(scene);
  } catch (error) {
    setStatus((error as Error).message);
  }
}

function bind(scene: BattleScene): void {
  scene.setPlacement((towerType, x, y) => {
    try {
      client.place(towerType, x, y);
    } catch (error) {
      setStatus((error as Error).message);
    }
  });

  client.on((message) => handle(message));
  client.onClose(() => reconnect());

  createButton?.addEventListener("click", async () => {
    try {
      const code = await client.create();
      setRoom(code);
      await connect(code);
    } catch (error) {
      setStatus((error as Error).message);
    }
  });

  joinButton?.addEventListener("click", async () => {
    try {
      await connect(getRoom());
    } catch (error) {
      setStatus((error as Error).message);
    }
  });

  readyButton?.addEventListener("click", () => {
    try {
      client.ready();
    } catch (error) {
      setStatus((error as Error).message);
    }
  });

  towerButtons.forEach((button) => {
    button.addEventListener("click", () => {
      towerButtons.forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      scene.setTower(button.dataset.tower ?? "rifle");
    });
  });
}

function build(scene: BattleScene): void {
  new Phaser.Game({
    backgroundColor: "#101820",
    height: 9 * TILE_SIZE,
    parent: "game",
    scene,
    type: Phaser.AUTO,
    width: 14 * TILE_SIZE
  });
}

function getName(): string {
  return nameInput?.value.trim() || "Commander";
}

function getRoom(): string {
  return roomInput?.value.trim() ?? "";
}

async function reconnect(): Promise<void> {
  if (reconnecting || roomId === null) {
    return;
  }

  reconnecting = true;
  setStatus("Reconnecting…");
  let delay = 500;

  for (;;) {
    try {
      await client.connect(roomId);

      if (token !== null) {
        client.resume(token);
      } else {
        client.join(getName());
      }

      break;
    } catch {
      await wait(delay);
      delay = Math.min(delay * 2, 5000);
    }
  }

  reconnecting = false;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyFull(player: string, payload: Snapshot): void {
  playerId = player;
  scene?.setLocalPlayer(player);
  scene?.setMap(payload.map);
  scene?.pushState(payload);
}

function handle(message: ServerMessage): void {
  if (message.type === "error") {
    setStatus(message.message);
    return;
  }

  if (message.type === "joined") {
    token = message.token;
    applyFull(message.player_id, message.payload);
    setStatus(`Joined ${message.payload.room_id}`);
    return;
  }

  if (message.type === "resumed") {
    applyFull(message.player_id, message.payload);
    setStatus(`Reconnected to ${message.payload.room_id}`);
    return;
  }

  if (message.type === "resume_failed") {
    token = null;
    client.join(getName());
    return;
  }

  if (message.type === "snapshot") {
    scene?.pushState(message.payload);
    scene?.playEvents(message.events);
    const self = message.payload.players.find((player) => player.id === playerId);
    const money = self ? `Money ${self.money}` : "Spectating";
    setStatus(
      `Wave ${message.payload.wave} | Base ${message.payload.base_health} | ${money}`
    );
  }
}

function setRoom(code: string): void {
  if (roomInput) {
    roomInput.value = code;
  }
}

function setStatus(text: string): void {
  if (status) {
    status.textContent = text;
  }
}
