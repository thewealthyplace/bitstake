// WalletEarnings — per-cycle BTC earnings table for a connected wallet.
// Shows staked amount, pool share, BTC earned, USD value, and distribution dates.
// Includes CSV export button.

import React from "react";
import type { WalletEarningsResponse } from "@/types/api";

interface WalletEarningsProps {
  earnings:     WalletEarningsResponse | null;
  isLoading:    boolean;
  error:        string | null;
  onExportCSV:  () => void;
  walletAddress: string | null;
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="earnings-summary-card">
      <p className="earnings-summary-card__label">{label}</p>
      <p className="earnings-summary-card__value">{value}</p>
      {sub && <p className="earnings-summary-card__sub">{sub}</p>}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day:   "numeric",
      year:  "2-digit",
    });
  } catch {
    return iso;
  }
}

export function WalletEarnings({
  earnings,
  isLoading,
  error,
  onExportCSV,
  walletAddress,
}: WalletEarningsProps) {
  if (!walletAddress) {
    return (
      <section className="wallet-earnings wallet-earnings--empty">
        <h2>My Earnings</h2>
        <p>Connect your wallet to view personal BTC earnings and staking history.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="wallet-earnings wallet-earnings--loading">
        <h2>My Earnings</h2>
        <div className="skeleton skeleton--wide" />
        <div className="skeleton skeleton--table" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="wallet-earnings wallet-earnings--error">
        <h2>My Earnings</h2>
        <p className="error-text">Failed to load earnings: {error}</p>
      </section>
    );
  }

  if (!earnings) return null;

  const hasEarnings = earnings.earnings.length > 0;

  return (
    <section className="wallet-earnings" aria-label="Wallet earnings">
      <div className="wallet-earnings__header">
        <h2 className="wallet-earnings__title">My Earnings</h2>
        <div className="wallet-earnings__actions">
          <button
            className="wallet-earnings__export-btn"
            onClick={onExportCSV}
            disabled={!hasEarnings}
            aria-label="Export earnings as CSV"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="wallet-earnings__summary">
        <SummaryCard
          label="Total BTC Earned"
          value={earnings.totalBtcEarnedFormatted}
          sub={`≈ $${earnings.totalBtcValueUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
        />
        <SummaryCard
          label="Total STX Staked"
          value={earnings.totalStxStaked
            ? `${(Number(earnings.totalStxStaked) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })} STX`
            : "—"}
        />
        <SummaryCard
          label="Unrealized APY"
          value={`${earnings.unrealizedApyPercent.toFixed(2)}%`}
          sub="*estimate"
        />
        <SummaryCard
          label="Next Distribution"
          value={formatDate(earnings.nextDistributionEstimate)}
          sub={`Block ${earnings.nextDistributionBlock.toLocaleString()}`}
        />
      </div>

      {/* Earnings history table */}
      {!hasEarnings ? (
        <p className="wallet-earnings__empty">No earnings recorded yet. Start stacking to earn BTC.</p>
      ) : (
        <div className="wallet-earnings__table-wrap">
          <table className="wallet-earnings__table" aria-label="Earnings history">
            <thead>
              <tr>
                <th scope="col">Cycle</th>
                <th scope="col">Pool</th>
                <th scope="col">Staked</th>
                <th scope="col">Share</th>
                <th scope="col">BTC Earned</th>
                <th scope="col">USD Value</th>
                <th scope="col">Distribution</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {earnings.earnings.map((e) => (
                <tr
                  key={`${e.cycleNumber}-${e.poolId}`}
                  className={e.claimed ? "earnings-row--claimed" : "earnings-row--pending"}
                >
                  <td>{e.cycleNumber}</td>
                  <td>{e.poolName}</td>
                  <td>{e.stakedAmountFormatted}</td>
                  <td>{e.poolSharePercent.toFixed(4)}%</td>
                  <td className="earnings-btc">{e.btcEarnedFormatted}</td>
                  <td>${e.btcValueUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  <td>
                    <span title={e.distributionDate}>{formatDate(e.distributionDate)}</span>
                  </td>
                  <td>
                    <span className={`badge badge--${e.claimed ? "claimed" : "pending"}`}>
                      {e.claimed ? "Claimed" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="wallet-earnings__disclaimer">
        * APY estimate based on historical cycle data. Actual returns vary.
      </p>
    </section>
  );
}
