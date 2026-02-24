// LivePoolStats — displays real-time pool statistics pulled from the SSE stream.
// Shows total STX stacked, BTC committed, estimated APY, cycle info, and per-pool table.

import React from "react";
import type { PoolStats } from "@/types/api";

interface LivePoolStatsProps {
  stats:           PoolStats | null;
  blockHeight:     number;
  connectionState: "connecting" | "connected" | "disconnected" | "error";
  lastUpdated:     Date | null;
  walletAddress?:  string | null;
}

function ConnectionDot({ state }: { state: LivePoolStatsProps["connectionState"] }) {
  const color = state === "connected" ? "#22c55e" : state === "connecting" ? "#f59e0b" : "#ef4444";
  const label = state === "connected" ? "Live" : state === "connecting" ? "Connecting…" : "Offline";
  return (
    <span className="connection-dot" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
      <span className="connection-dot__label">{label}</span>
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card">
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{value}</p>
      {sub && <p className="stat-card__sub">{sub}</p>}
    </div>
  );
}

export function LivePoolStats({
  stats,
  blockHeight,
  connectionState,
  lastUpdated,
  walletAddress,
}: LivePoolStatsProps) {
  if (!stats) {
    return (
      <div className="live-pool-stats live-pool-stats--loading">
        <div className="skeleton skeleton--wide" />
        <div className="live-pool-stats__grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton skeleton--card" />
          ))}
        </div>
      </div>
    );
  }

  const poolShare = walletAddress && stats.poolSharePercent != null
    ? `${stats.poolSharePercent.toFixed(4)}% share`
    : undefined;

  return (
    <section className="live-pool-stats" aria-label="Live pool statistics">
      <div className="live-pool-stats__header">
        <h2 className="live-pool-stats__title">Pool Overview</h2>
        <div className="live-pool-stats__meta">
          <ConnectionDot state={connectionState} />
          <span className="live-pool-stats__block">Block {blockHeight.toLocaleString()}</span>
          {lastUpdated && (
            <span className="live-pool-stats__updated">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Top-level stat cards */}
      <div className="live-pool-stats__grid">
        <StatCard
          label="Total STX Stacked"
          value={stats.totalStxStackedFormatted}
          sub={poolShare}
        />
        <StatCard
          label="BTC Committed (cycle)"
          value={stats.btcCommittedFormatted}
        />
        <StatCard
          label="Estimated APY"
          value={`${stats.estimatedApyPercent.toFixed(2)}%`}
          sub="*varies by cycle"
        />
        <StatCard
          label="Participants"
          value={stats.participantCount.toLocaleString()}
        />
      </div>

      {/* APY disclaimer */}
      <p className="live-pool-stats__disclaimer">
        * APY is an estimate based on current BTC and STX prices and last cycle rewards.
        Actual returns vary by stacking cycle, total participation, and miner fees.
      </p>

      {/* Per-pool breakdown table */}
      <div className="live-pool-stats__table-wrap">
        <table className="live-pool-stats__table" aria-label="Per-pool breakdown">
          <thead>
            <tr>
              <th scope="col">Pool</th>
              <th scope="col">Token</th>
              <th scope="col">Total Stacked</th>
              <th scope="col">Est. APY</th>
              <th scope="col">Participants</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {stats.pools.map((p) => (
              <tr key={p.poolId} className={p.active ? "" : "pool-row--inactive"}>
                <td>{p.name}</td>
                <td><code>{p.tokenSymbol}</code></td>
                <td>{p.totalStackedFormatted}</td>
                <td>{p.apyPercent.toFixed(2)}%</td>
                <td>{p.participantCount.toLocaleString()}</td>
                <td>
                  <span className={`badge badge--${p.active ? "active" : "inactive"}`}>
                    {p.active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
