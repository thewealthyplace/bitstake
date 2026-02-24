// WebSocket server utilities for bitstake live dashboard
// Handles Hiro WebSocket subscriptions and fan-out to connected clients

import type { WsMessage, WsPoolStatsUpdate, WsNewBlock, WsCycleChange } from "@/types/api";
import {
  blockToCycleNumber,
  blocksUntilCycleEnd,
  cycleEndBlock,
  SECONDS_PER_BLOCK,
} from "@/lib/apy";

const HIRO_WS_URL = "wss://api.hiro.so";

// In-memory set of active client send functions (server-sent events)
// In production this would be replaced by a proper pub-sub (Redis, etc.)
type SendFn = (msg: WsMessage) => void;
const clients = new Set<SendFn>();

let hiroWs: WebSocket | null = null;
let lastBlock = 0;
let lastCycle = 0;

export function registerClient(send: SendFn): () => void {
  clients.add(send);
  return () => clients.delete(send);
}

function broadcast(msg: WsMessage) {
  for (const send of clients) {
    try { send(msg); } catch { /* client disconnected */ }
  }
}

function handleNewBlock(blockHeight: number, blockHash: string) {
  if (blockHeight <= lastBlock) return;
  lastBlock = blockHeight;

  const newBlock: WsNewBlock = {
    blockHeight,
    blockHash,
    timestamp: Date.now(),
  };
  broadcast({ event: "new_block", data: newBlock, timestamp: Date.now() });

  const newCycle = blockToCycleNumber(blockHeight);
  if (newCycle !== lastCycle) {
    const cycleChange: WsCycleChange = {
      previousCycle: lastCycle,
      newCycle,
      blockHeight,
    };
    broadcast({ event: "cycle_change", data: cycleChange, timestamp: Date.now() });
    lastCycle = newCycle;
  }

  // Emit pool stats update every block
  const statsUpdate: WsPoolStatsUpdate = {
    blockHeight,
    totalStxStacked:      "4000000000000", // placeholder — real impl queries chain
    estimatedApyPercent:  8.4,
    cycleEndBlock:        cycleEndBlock(newCycle),
    blocksUntilCycleEnd:  blocksUntilCycleEnd(blockHeight),
  };
  broadcast({ event: "pool_stats_update", data: statsUpdate, timestamp: Date.now() });
}

export function connectToHiro(): void {
  if (hiroWs && hiroWs.readyState === WebSocket.OPEN) return;

  try {
    hiroWs = new WebSocket(`${HIRO_WS_URL}/extended/v1/ws`);

    hiroWs.onopen = () => {
      hiroWs?.send(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "block_connected",
        params: {},
      }));
    };

    hiroWs.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg?.method === "block_connected" && msg?.params?.result) {
          const { block_height, index_block_hash } = msg.params.result;
          handleNewBlock(Number(block_height), String(index_block_hash));
        }
      } catch { /* ignore malformed messages */ }
    };

    hiroWs.onclose = () => {
      // Reconnect after 5 seconds
      setTimeout(connectToHiro, 5_000);
    };

    hiroWs.onerror = () => {
      hiroWs?.close();
    };
  } catch {
    setTimeout(connectToHiro, 5_000);
  }
}

export function disconnectFromHiro(): void {
  hiroWs?.close();
  hiroWs = null;
}
