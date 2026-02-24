// APY calculation utilities for bitstake dashboard
//
// Formula from issue spec:
//   APY = (btcValueUsd / stxValueUsd) * CYCLES_PER_YEAR * 100
//
// Where:
//   btcValueUsd  = btc_reward_satoshis / 1e8 * btcPriceUsd
//   stxValueUsd  = total_stx_stacked  / 1e6 * stxPriceUsd
//   CYCLES_PER_YEAR = 26 (52 weeks / 2 weeks per cycle)

export const CYCLES_PER_YEAR = 26;
export const BLOCKS_PER_CYCLE = 2100;
export const SECONDS_PER_BLOCK = 600; // ~10 minutes on Stacks

// ── Core APY formula ─────────────────────────────────────────────────

export function computeAPY(params: {
  btcRewardSatoshis: number | bigint;
  totalStxStackedMicro: number | bigint;
  btcPriceUsd: number;
  stxPriceUsd: number;
}): number {
  const { btcRewardSatoshis, totalStxStackedMicro, btcPriceUsd, stxPriceUsd } = params;

  const btcReward = Number(btcRewardSatoshis) / 1e8;
  const totalStx  = Number(totalStxStackedMicro) / 1e6;

  if (totalStx === 0 || stxPriceUsd === 0) return 0;

  const btcValueUsd = btcReward * btcPriceUsd;
  const stxValueUsd = totalStx  * stxPriceUsd;

  return (btcValueUsd / stxValueUsd) * CYCLES_PER_YEAR * 100;
}

// ── Formatting helpers ────────────────────────────────────────────────

export function formatSTX(microStx: number | bigint): string {
  const stx = Number(microStx) / 1_000_000;
  return stx.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " STX";
}

export function formatBTC(satoshis: number | bigint): string {
  const btc = Number(satoshis) / 1e8;
  return btc.toLocaleString("en-US", {
    minimumFractionDigits: 5,
    maximumFractionDigits: 8,
  }) + " BTC";
}

export function formatAPY(apy: number): string {
  return apy.toFixed(2) + "%";
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

// ── Block / time helpers ──────────────────────────────────────────────

export function blocksToSeconds(blocks: number): number {
  return blocks * SECONDS_PER_BLOCK;
}

export function blocksToEstimatedDate(currentBlock: number, targetBlock: number): Date {
  const blocksRemaining = Math.max(0, targetBlock - currentBlock);
  const secondsRemaining = blocksToSeconds(blocksRemaining);
  return new Date(Date.now() + secondsRemaining * 1000);
}

export function blockToCycleNumber(blockHeight: number): number {
  // Stacks PoX cycle starts at block 0 on regtest; on mainnet it has an offset
  // Simplified: cycle = floor(blockHeight / BLOCKS_PER_CYCLE)
  return Math.floor(blockHeight / BLOCKS_PER_CYCLE);
}

export function cycleStartBlock(cycleNumber: number): number {
  return cycleNumber * BLOCKS_PER_CYCLE;
}

export function cycleEndBlock(cycleNumber: number): number {
  return (cycleNumber + 1) * BLOCKS_PER_CYCLE - 1;
}

export function blocksUntilCycleEnd(blockHeight: number): number {
  const end = cycleEndBlock(blockToCycleNumber(blockHeight));
  return Math.max(0, end - blockHeight);
}

// ── CSV export helper ─────────────────────────────────────────────────

export interface CSVRow {
  [key: string]: string | number | boolean;
}

export function toCSV(rows: CSVRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const header = headers.join(",");
  const body = rows.map((row) =>
    headers.map((h) => {
      const val = String(row[h] ?? "");
      // Escape commas and quotes
      return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(",")
  );
  return [header, ...body].join("\n");
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Average APY ───────────────────────────────────────────────────────

export function averageAPY(apyValues: number[]): number {
  if (apyValues.length === 0) return 0;
  return apyValues.reduce((a, b) => a + b, 0) / apyValues.length;
}

// ── Seed historical data generator (for demo / fallback) ─────────────

export function generateMockCycleHistory(
  cycleCount: number,
  currentBlock: number,
  baseBtcPriceUsd = 65000,
  baseStxPriceUsd = 0.95
): Array<{
  cycleNumber: number;
  cycleStartBlock: number;
  cycleEndBlock: number;
  totalStxStacked: string;
  btcRewardSatoshis: string;
  apyPercent: number;
  stxPriceUsd: number;
  btcPriceUsd: number;
  timestamp: string;
}> {
  const currentCycle = blockToCycleNumber(currentBlock);
  const records = [];

  for (let i = cycleCount - 1; i >= 0; i--) {
    const cn = currentCycle - i;
    if (cn < 0) continue;

    // Pseudo-random variation seeded by cycle number
    const seed = (cn * 17 + 3) % 100;
    const stxVariation  = 1 + (seed - 50) / 1000;       // ±5%
    const btcVariation  = 1 + ((cn * 7) % 100 - 50) / 500; // ±10%
    const apyVariation  = 1 + ((cn * 13) % 100 - 50) / 200; // ±25%

    const totalStxMicro  = Math.floor(1_500_000_000_000 * stxVariation);  // ~1.5M STX
    const btcRewardSat   = Math.floor(230_000 * btcVariation);             // ~0.0023 BTC
    const stxPrice       = baseStxPriceUsd * stxVariation;
    const btcPrice       = baseBtcPriceUsd * btcVariation;
    const apy            = computeAPY({
      btcRewardSatoshis:    btcRewardSat,
      totalStxStackedMicro: totalStxMicro,
      btcPriceUsd:          btcPrice,
      stxPriceUsd:          stxPrice,
    }) * apyVariation;

    const start = cycleStartBlock(cn);
    const end   = cycleEndBlock(cn);
    const blocksFromNow = currentBlock - end;
    const msAgo  = blocksFromNow * SECONDS_PER_BLOCK * 1000;

    records.push({
      cycleNumber:       cn,
      cycleStartBlock:   start,
      cycleEndBlock:     end,
      totalStxStacked:   String(totalStxMicro),
      btcRewardSatoshis: String(btcRewardSat),
      apyPercent:        Math.max(0, Number(apy.toFixed(4))),
      stxPriceUsd:       Number(stxPrice.toFixed(4)),
      btcPriceUsd:       Number(btcPrice.toFixed(2)),
      timestamp:         new Date(Date.now() - msAgo).toISOString(),
    });
  }

  return records;
}
