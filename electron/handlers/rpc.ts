import { ipcMain } from "electron";
import * as DiscordRPC from "discord-rpc";
import Store from "electron-store";
import type { Schema } from "conf";
import { StoreSchema, schema } from "../store.js";

interface RPCActivity {
  details: string;
  state: string;
  type: number;
  assets: { large_image: string };
  instance: boolean;
  timestamps?: { start: number; end: number };
  buttons?: { label: string; url: string }[];
}

interface RPCUpdateOptions {
  clear?: boolean;
  title?: string;
  artist?: string;
  albumArt?: string;
  duration?: number;
  currentTime?: number;
  isPlaying?: boolean;
  trackId?: string;
}


interface RPCClientExtended extends DiscordRPC.Client {
  request(cmd: string, args: Record<string, unknown>): Promise<unknown>;
}

const clientId = "1487748905943695491";
DiscordRPC.register(clientId);

const store = new Store<StoreSchema>({ schema: schema as Schema<StoreSchema> });
let rpc: RPCClientExtended | null = null;
let currentActivity: RPCActivity | null = null;
let progressInterval: NodeJS.Timeout | null = null;
let autoClearTimeout: NodeJS.Timeout | null = null;

let isReady = false;
let initPromise: Promise<void> | null = null;

async function initRPC() {
  if (isReady && rpc) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!rpc) {
      rpc = new DiscordRPC.Client({ transport: "ipc" }) as RPCClientExtended;

      (rpc as RPCClientExtended).on("ready", () => {
        console.log("[Discord RPC] Connected");
        isReady = true;
        if (currentActivity) {
          rpc
            ?.request("SET_ACTIVITY", {
              pid: process.pid,
              activity: currentActivity,
            })
            .catch(console.warn);
        }
      });

      (rpc as unknown as NodeJS.EventEmitter).on("disconnected", () => {
        console.log("[Discord RPC] Disconnected");
        rpc = null;
        isReady = false;
        initPromise = null;
      });
    }

    try {
      await rpc!.login({ clientId });

      
      let attempts = 0;
      while (!isReady && rpc && attempts < 50) {
        
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
    } catch (err) {
      console.warn(`[Discord RPC] Connection failed: ${err instanceof Error ? err.message : err}`);
      rpc = null;
      isReady = false;
      initPromise = null;
    }
  })();

  return initPromise;
}

export function clearRPC() {
  currentActivity = null;
  
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  if (autoClearTimeout) {
    clearTimeout(autoClearTimeout);
    autoClearTimeout = null;
  }
  if (rpc) {
    rpc.clearActivity().catch(console.warn);
  }
}

process.on("exit", () => {
  if (rpc) {
    rpc.clearActivity().catch(() => {});
  }
});

export function registerRPCHandlers() {
  const isEnabled = store.get("discordRPC", true);
  if (isEnabled) {
    initRPC();
  }
  store.onDidChange("discordRPC", (newValue: boolean | undefined) => {
    if (newValue) {
      if (!rpc) initRPC();
    } else {
      clearRPC();
      if (rpc) {
        rpc.destroy();
        rpc = null;
      }
    }
  });

  ipcMain.handle("update-rpc", async (_, options: RPCUpdateOptions) => {
    if (!store.get("discordRPC", true)) {
      return;
    }

    if (autoClearTimeout) {
      clearTimeout(autoClearTimeout);
      autoClearTimeout = null;
    }

    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }

    if (options.clear) {
      clearRPC();
      return;
    }

    const { title, artist, albumArt, duration, currentTime, isPlaying } =
      options;

    if (isPlaying === false) {
      clearRPC();
      return;
    }

    if (!rpc || !isReady) {
      initRPC();
    }

    const buttons: { label: string; url: string }[] = [
      { label: "🎧 Play on Lune", url: "https://github.com/saraansx/Lune-Music" }
    ];

    const activityObj: RPCActivity = {
      details: title || "",
      state: artist || "",
      type: 2,
      assets: {
        large_image: albumArt || "lune_logo",
      },
      instance: false,
      buttons,
    };

    if (duration && typeof currentTime === "number" && duration > 0) {
      const now = Date.now();
      const start = Math.floor(now - currentTime);
      const end = Math.floor(start + duration);
      activityObj.timestamps = {
        start,
        end,
      };
      const timeRemaining = duration - currentTime;
      if (timeRemaining > 0) {
        autoClearTimeout = setTimeout(() => {
          clearRPC();
        }, timeRemaining + 1500);
      }
    }

    currentActivity = activityObj;

    if (rpc && isReady) {
      rpc
        .request("SET_ACTIVITY", {
          pid: process.pid,
          activity: activityObj,
        })
        .catch(console.warn);
    }
  });
}
