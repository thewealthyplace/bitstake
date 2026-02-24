"use client";

// /dashboard — bitstake APY tracking and analytics page
// Live pool stats, 52-cycle APY chart, wallet earnings, and cycle calendar.

import React, { useState } from "react";
import { CycleCountdown }  from "@/components/CycleCountdown";
import { LivePoolStats }   from "@/components/LivePoolStats";
import { APYChart }        from "@/components/APYChart";
import { WalletEarnings }  from "@/components/WalletEarnings";
import { CycleCalendar }   from "@/components/CycleCalendar";
import { useLivePoolStats } from "@/hooks/useLivePoolStats";
import { useAPYHistory }   from "@/hooks/useAPYHistory";
import { useWalletEarnings } from "@/hooks/useWalletEarnings";

// Wallet connection is handled by @hirosystems/connect in production.
// This page accepts a ?address= query param for read-only mode.

export default function DashboardPage() {
  // In production, walletAddress comes from the connect hook.
  // For now, support ?address= for read-only portfolio view.
  const [walletAddress, setWalletAddress] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("address");
  });
  const [addressInput, setAddressInput] = useState("");

  const { stats, blockHeight, connectionState, lastUpdated, refresh } = useLivePoolStats();
  const { history, isLoading: histLoading, error: histError }         = useAPYHistory(52);
  const { earnings, isLoading: earnLoading, error: earnError, exportCSV } = useWalletEarnings(walletAddress);

  const userUnlockBlocks: number[] = (earnings?.earnings ?? [])
    .map((e) => e.distributionBlock)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = addressInput.trim();
    if (trimmed) setWalletAddress(trimmed);
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <h1 className="dashboard-header__title">bitstake Analytics</h1>
        <p className="dashboard-header__subtitle">
          Real-time APY tracking, historical BTC yield data, and personal earnings.
        </p>
        <button
          className="dashboard-header__refresh"
          onClick={refresh}
          aria-label="Refresh dashboard data"
        >
          Refresh
        </button>
      </header>

      {/* Cycle countdown + connection */}
      {stats && (
        <CycleCountdown
          cycleNumber={stats.cycleNumber}
          blocksUntilCycleEnd={stats.blocksUntilCycleEnd}
          cycleEndBlock={stats.cycleEndBlock}
          currentBlock={blockHeight}
        />
      )}

      {/* Live pool stats */}
      <LivePoolStats
        stats={stats}
        blockHeight={blockHeight}
        connectionState={connectionState}
        lastUpdated={lastUpdated}
        walletAddress={walletAddress}
      />

      {/* Historical APY chart */}
      <APYChart
        history={history}
        isLoading={histLoading}
        error={histError}
      />

      {/* Cycle calendar */}
      <CycleCalendar
        currentBlock={blockHeight || 150_000}
        userUnlockBlocks={userUnlockBlocks}
        visibleCycles={8}
      />

      {/* Wallet section */}
      <section className="dashboard-wallet">
        {!walletAddress ? (
          <div className="dashboard-wallet__connect">
            <h2>View Earnings</h2>
            <p>Enter a Stacks address to view earnings in read-only mode, or connect your wallet.</p>
            <form onSubmit={handleAddressSubmit} className="dashboard-wallet__form">
              <input
                type="text"
                placeholder="SP... or ST... address"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                className="dashboard-wallet__input"
                aria-label="Stacks wallet address"
              />
              <button type="submit" className="dashboard-wallet__btn">
                View
              </button>
            </form>
            {/* In production: <ConnectWalletButton onConnect={setWalletAddress} /> */}
          </div>
        ) : (
          <>
            <div className="dashboard-wallet__address-bar">
              <span className="dashboard-wallet__address">{walletAddress}</span>
              <button
                className="dashboard-wallet__clear"
                onClick={() => setWalletAddress(null)}
              >
                Clear
              </button>
            </div>
            <WalletEarnings
              earnings={earnings}
              isLoading={earnLoading}
              error={earnError}
              onExportCSV={exportCSV}
              walletAddress={walletAddress}
            />
          </>
        )}
      </section>
    </main>
  );
}
