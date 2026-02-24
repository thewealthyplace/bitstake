// API type definitions for the bitstake APY dashboard

// ── Pool Stats ────────────────────────────────────────────────────────

export interface PoolStats {
  cycleNumber: number;
  cycleEndBlock: number;
  blocksUntilCycleEnd: number;
  secondsUntilCycleEnd: number;
  totalStxStacked: string;        // micro-STX as string (bigint-safe)
  totalStxStackedFormatted: string; // e.g. "2,450,000.00 STX"
  btcCommitted: string;           // satoshis as string
  btcCommittedFormatted: string;  // e.g. "0.15234 BTC"
  estimatedApyPercent: number;    // e.g. 8.34
  poolSharePercent: number | null; // null if wallet not connected
  participantCount: number;
  pools: PoolStatBreakdown[];
  updatedAtBlock: number;
}

export interface PoolStatBreakdown {
  poolId: number;
  name: string;
  tokenSymbol: string;
  totalStacked: string;
  totalStackedFormatted: string;
  apyPercent: number;
  participantCount: number;
  active: boolean;
}

// ── History ───────────────────────────────────────────────────────────

export interface CycleRecord {
  cycleNumber: number;
  cycleStartBlock: number;
  cycleEndBlock: number;
  totalStxStacked: string;
  btcRewardSatoshis: string;
  apyPercent: number;
  stxPriceUsd: number;
  btcPriceUsd: number;
  timestamp: string;   // ISO 8601
}

export interface PoolHistoryResponse {
  cycles: CycleRecord[];
  averageApyPercent: number;
  maxApyPercent: number;
  minApyPercent: number;
  soloStackingThresholdSTX: number;
  requestedCycles: number;
}

// ── Wallet Earnings ───────────────────────────────────────────────────

export interface EarningRecord {
  cycleNumber: number;
  poolId: number;
  poolName: string;
  stakedAmount: string;       // micro-STX
  stakedAmountFormatted: string;
  poolSharePercent: number;
  btcEarnedSatoshis: string;
  btcEarnedFormatted: string;
  btcValueUsd: number;
  distributionBlock: number;
  distributionDate: string;   // ISO 8601 estimate
  claimed: boolean;
}

export interface WalletEarningsResponse {
  address: string;
  totalBtcEarnedSatoshis: string;
  totalBtcEarnedFormatted: string;
  totalBtcValueUsd: number;
  totalStxStaked: string;
  unrealizedApyPercent: number;
  nextDistributionBlock: number;
  nextDistributionEstimate: string;  // ISO 8601
  earnings: EarningRecord[];
}

// ── WebSocket events ──────────────────────────────────────────────────

export type WsEventType =
  | "pool_stats_update"
  | "new_block"
  | "cycle_change"
  | "rewards_distributed"
  | "connected"
  | "error";

export interface WsMessage<T = unknown> {
  event: WsEventType;
  data: T;
  timestamp: number;
}

export interface WsPoolStatsUpdate {
  blockHeight: number;
  totalStxStacked: string;
  estimatedApyPercent: number;
  cycleEndBlock: number;
  blocksUntilCycleEnd: number;
}

export interface WsNewBlock {
  blockHeight: number;
  blockHash: string;
  timestamp: number;
}

export interface WsCycleChange {
  previousCycle: number;
  newCycle: number;
  blockHeight: number;
}
