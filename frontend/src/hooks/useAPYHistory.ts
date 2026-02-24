// useAPYHistory — fetches 52 cycles of historical APY data for the chart

import { useState, useEffect } from "react";
import type { PoolHistoryResponse } from "@/types/api";

interface UseAPYHistoryResult {
  history:   PoolHistoryResponse | null;
  isLoading: boolean;
  error:     string | null;
  refetch:   () => void;
}

export function useAPYHistory(cycles = 52): UseAPYHistoryResult {
  const [history,   setHistory]   = useState<PoolHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [tick,      setTick]      = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/v1/pool/history?cycles=${cycles}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<PoolHistoryResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setHistory(data);
          setIsLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [cycles, tick]);

  return { history, isLoading, error, refetch: () => setTick((t) => t + 1) };
}
