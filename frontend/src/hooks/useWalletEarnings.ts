// useWalletEarnings — fetches wallet-specific earnings and BTC history

import { useState, useEffect, useCallback } from "react";
import type { WalletEarningsResponse } from "@/types/api";
import { toCSV, downloadCSV } from "@/lib/apy";

interface UseWalletEarningsResult {
  earnings:    WalletEarningsResponse | null;
  isLoading:   boolean;
  error:       string | null;
  refetch:     () => void;
  exportCSV:   () => void;
}

export function useWalletEarnings(address: string | null): UseWalletEarningsResult {
  const [earnings,  setEarnings]  = useState<WalletEarningsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [tick,      setTick]      = useState(0);

  useEffect(() => {
    if (!address) { setEarnings(null); return; }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/v1/wallet/${encodeURIComponent(address)}/earnings`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<WalletEarningsResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setEarnings(data);
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
  }, [address, tick]);

  const exportCSV = useCallback(() => {
    if (!earnings) return;
    const rows = earnings.earnings.map((e) => ({
      Cycle:           e.cycleNumber,
      Pool:            e.poolName,
      "Staked (STX)":  e.stakedAmountFormatted,
      "Pool Share (%)": e.poolSharePercent,
      "BTC Earned":    e.btcEarnedFormatted,
      "BTC Value (USD)": e.btcValueUsd,
      "Distribution Block": e.distributionBlock,
      "Distribution Date":  e.distributionDate,
      Claimed: e.claimed ? "Yes" : "No",
    }));
    const csv = toCSV(rows);
    downloadCSV(csv, `bitstake-earnings-${address}-${Date.now()}.csv`);
  }, [earnings, address]);

  return {
    earnings,
    isLoading,
    error,
    refetch:   () => setTick((t) => t + 1),
    exportCSV,
  };
}
