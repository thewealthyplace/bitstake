// useLivePoolStats — subscribes to the /api/v1/ws SSE stream and
// keeps pool stats in sync with every new block.

import { useState, useEffect, useCallback } from "react";
import type { PoolStats, WsMessage, WsPoolStatsUpdate, WsNewBlock } from "@/types/api";

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

interface UseLivePoolStatsResult {
  stats:           PoolStats | null;
  blockHeight:     number;
  connectionState: ConnectionState;
  lastUpdated:     Date | null;
  refresh:         () => void;
}

const POLL_INTERVAL_MS = 12_000; // fallback polling when SSE is unavailable

async function fetchPoolStats(): Promise<PoolStats> {
  const res = await fetch("/api/v1/pool/stats");
  if (!res.ok) throw new Error(`pool/stats responded ${res.status}`);
  return res.json();
}

export function useLivePoolStats(): UseLivePoolStatsResult {
  const [stats,           setStats]           = useState<PoolStats | null>(null);
  const [blockHeight,     setBlockHeight]      = useState<number>(0);
  const [connectionState, setConnectionState]  = useState<ConnectionState>("connecting");
  const [lastUpdated,     setLastUpdated]      = useState<Date | null>(null);
  const [tick,            setTick]             = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Initial REST fetch
  useEffect(() => {
    fetchPoolStats()
      .then((data) => {
        setStats(data);
        setBlockHeight(data.updatedAtBlock);
        setLastUpdated(new Date());
      })
      .catch(console.error);
  }, [tick]);

  // SSE subscription for live updates
  useEffect(() => {
    let es: EventSource | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    function connectSSE() {
      setConnectionState("connecting");
      es = new EventSource("/api/v1/ws");

      es.onopen = () => setConnectionState("connected");

      es.onmessage = (event: MessageEvent<string>) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);

          if (msg.event === "connected") {
            setConnectionState("connected");
            return;
          }

          if (msg.event === "pool_stats_update") {
            const update = msg.data as WsPoolStatsUpdate;
            setBlockHeight(update.blockHeight);
            // Merge update into existing stats snapshot
            setStats((prev) =>
              prev
                ? {
                    ...prev,
                    totalStxStacked:      update.totalStxStacked,
                    estimatedApyPercent:  update.estimatedApyPercent,
                    cycleEndBlock:        update.cycleEndBlock,
                    blocksUntilCycleEnd:  update.blocksUntilCycleEnd,
                    secondsUntilCycleEnd: update.blocksUntilCycleEnd * 600,
                    updatedAtBlock:       update.blockHeight,
                  }
                : prev
            );
            setLastUpdated(new Date());
          }

          if (msg.event === "new_block") {
            const block = msg.data as WsNewBlock;
            setBlockHeight(block.blockHeight);
          }

          if (msg.event === "cycle_change") {
            // Re-fetch full stats on cycle change to get fresh BTC committed
            fetchPoolStats()
              .then((data) => {
                setStats(data);
                setLastUpdated(new Date());
              })
              .catch(console.error);
          }
        } catch { /* ignore malformed SSE events */ }
      };

      es.onerror = () => {
        setConnectionState("disconnected");
        es?.close();
        // Fall back to polling
        fallbackTimer = setInterval(() => {
          fetchPoolStats()
            .then((data) => {
              setStats(data);
              setBlockHeight(data.updatedAtBlock);
              setLastUpdated(new Date());
            })
            .catch(console.error);
        }, POLL_INTERVAL_MS);
      };
    }

    if (typeof window !== "undefined" && "EventSource" in window) {
      connectSSE();
    } else {
      // SSE not available — poll
      setConnectionState("disconnected");
      fallbackTimer = setInterval(() => {
        fetchPoolStats()
          .then((data) => {
            setStats(data);
            setBlockHeight(data.updatedAtBlock);
            setLastUpdated(new Date());
          })
          .catch(console.error);
      }, POLL_INTERVAL_MS);
    }

    return () => {
      es?.close();
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, []);

  return { stats, blockHeight, connectionState, lastUpdated, refresh };
}
