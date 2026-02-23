import React from "react";
import type { PoolData } from "../hooks/usePoolTiers";

interface PoolTierCardProps {
  pool: PoolData;
  onSelect: (poolId: number) => void;
  selected: boolean;
}

function formatSTX(ustx: bigint): string {
  return (Number(ustx) / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PoolTierCard({ pool, onSelect, selected }: PoolTierCardProps) {
  if (pool.isLoading) {
    return (
      <div className="pool-card pool-card--loading">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--line" />
        <div className="skeleton skeleton--line" />
      </div>
    );
  }

  return (
    <div
      className={`pool-card ${selected ? "pool-card--selected" : ""} ${!pool.active ? "pool-card--inactive" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => pool.active && onSelect(pool.id)}
      onKeyDown={(e) => e.key === "Enter" && pool.active && onSelect(pool.id)}
    >
      <div className="pool-card__header">
        <span className="pool-card__name">{pool.name}</span>
        <span className="pool-card__token">{pool.tokenSymbol}</span>
        {!pool.active && <span className="pool-card__badge pool-card__badge--inactive">Inactive</span>}
      </div>

      <div className="pool-card__apy">{pool.apy} APY</div>

      <dl className="pool-card__stats">
        <div className="pool-card__stat">
          <dt>Lockup</dt>
          <dd>{pool.lockupCycles} cycle{pool.lockupCycles > 1 ? "s" : ""} (~{pool.lockupDays} days)</dd>
        </div>
        <div className="pool-card__stat">
          <dt>Min. Deposit</dt>
          <dd>{pool.minDepositSTX.toLocaleString()} STX</dd>
        </div>
        <div className="pool-card__stat">
          <dt>Total Stacked</dt>
          <dd>{formatSTX(pool.totalStacked)} STX</dd>
        </div>
      </dl>

      <p className="pool-card__description">{pool.description}</p>

      {pool.active && (
        <button
          className={`pool-card__cta ${selected ? "pool-card__cta--selected" : ""}`}
          onClick={(e) => { e.stopPropagation(); onSelect(pool.id); }}
        >
          {selected ? "Selected" : "Select Pool"}
        </button>
      )}
    </div>
  );
}
