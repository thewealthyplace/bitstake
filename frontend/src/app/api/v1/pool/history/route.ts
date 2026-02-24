// GET /api/v1/pool/history?cycles=52
// Returns per-cycle APY, BTC rewards, STX stacked, and price data
// for the requested number of past stacking cycles (max 52).

import { NextRequest, NextResponse } from "next/server";
import {
  computeAPY,
  generateMockCycleHistory,
  blockToCycleNumber,
  averageAPY,
  BLOCKS_PER_CYCLE,
} from "@/lib/apy";
import type { PoolHistoryResponse, CycleRecord } from "@/types/api";

const HIRO_API = process.env.NEXT_PUBLIC_HIRO_API_URL || "https://api.hiro.so";
const MAX_CYCLES = 52;

// Solo stacking threshold is ~80,000 STX on mainnet
const SOLO_STACKING_THRESHOLD_STX = 80_000;

async function fetchCurrentBlockHeight(): Promise<number> {
  try {
    const res = await fetch(`${HIRO_API}/v2/info`, { next: { revalidate: 30 } });
    const data = await res.json();
    return data.stacks_tip_height ?? 0;
  } catch {
    return 150_000; // safe fallback for when API is unreachable in dev
  }
}

// Fetch epoch rewards from the bitstake-rewards contract for a given cycle.
// Falls back to synthetic data when chain is unreachable.
async function fetchCycleRewards(
  _cycleNumber: number
): Promise<{ btcSatoshis: number; totalStxMicro: number } | null> {
  // In production this would call bitstake-rewards.get-epoch-reward(cycleNumber, poolId)
  // and aggregate across all pools. For now we always return null to use fallback.
  return null;
}

function buildCycleRecord(params: {
  cycleNumber: number;
  totalStxMicro: number;
  btcSatoshis: number;
  stxPriceUsd: number;
  btcPriceUsd: number;
  currentBlock: number;
}): CycleRecord {
  const { cycleNumber, totalStxMicro, btcSatoshis, stxPriceUsd, btcPriceUsd, currentBlock } = params;

  const startBlock   = cycleNumber * BLOCKS_PER_CYCLE;
  const endBlock     = (cycleNumber + 1) * BLOCKS_PER_CYCLE - 1;
  const blocksAgo    = Math.max(0, currentBlock - endBlock);
  const msAgo        = blocksAgo * 600_000;
  const timestamp    = new Date(Date.now() - msAgo).toISOString();

  const apyPercent = computeAPY({
    btcRewardSatoshis:    btcSatoshis,
    totalStxStackedMicro: totalStxMicro,
    btcPriceUsd,
    stxPriceUsd,
  });

  const btcFormatted = (btcSatoshis / 1e8).toFixed(8) + " BTC";
  const stxFormatted = (totalStxMicro / 1e6).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " STX";

  return {
    cycleNumber,
    cycleStartBlock: startBlock,
    cycleEndBlock:   endBlock,
    totalStxStacked: String(totalStxMicro),
    btcRewardSatoshis: String(btcSatoshis),
    apyPercent:      Number(apyPercent.toFixed(4)),
    stxPriceUsd,
    btcPriceUsd,
    timestamp,
  };
  void btcFormatted; void stxFormatted; // used in extended response if needed
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cyclesParam = searchParams.get("cycles");
  const requestedCycles = Math.min(
    MAX_CYCLES,
    Math.max(1, parseInt(cyclesParam ?? "52", 10) || 52)
  );

  const currentBlock   = await fetchCurrentBlockHeight();
  const currentCycle   = blockToCycleNumber(currentBlock);

  // Attempt to load real on-chain data; fall back to synthetic if unavailable
  const records: CycleRecord[] = [];

  for (let i = requestedCycles - 1; i >= 0; i--) {
    const cn = currentCycle - i;
    if (cn < 0) continue;

    const onChain = await fetchCycleRewards(cn);

    if (onChain) {
      records.push(buildCycleRecord({
        cycleNumber:   cn,
        totalStxMicro: onChain.totalStxMicro,
        btcSatoshis:   onChain.btcSatoshis,
        stxPriceUsd:   0.95,
        btcPriceUsd:   65000,
        currentBlock,
      }));
    }
  }

  // Supplement missing records with synthetic history
  if (records.length < requestedCycles) {
    const synthetic = generateMockCycleHistory(requestedCycles, currentBlock);
    // Merge: use on-chain where available, synthetic for the rest
    const onChainCycles = new Set(records.map((r) => r.cycleNumber));
    for (const s of synthetic) {
      if (!onChainCycles.has(s.cycleNumber)) {
        records.push({
          ...s,
          btcRewardSatoshis: s.btcRewardSatoshis,
          totalStxStacked:   s.totalStxStacked,
        });
      }
    }
    records.sort((a, b) => a.cycleNumber - b.cycleNumber);
  }

  const apyValues     = records.map((r) => r.apyPercent);
  const avgApy        = averageAPY(apyValues);
  const maxApy        = Math.max(...apyValues, 0);
  const minApy        = Math.min(...apyValues.filter((v) => v > 0), 0);

  const response: PoolHistoryResponse = {
    cycles:                    records.slice(-requestedCycles),
    averageApyPercent:         Number(avgApy.toFixed(4)),
    maxApyPercent:             Number(maxApy.toFixed(4)),
    minApyPercent:             Number(minApy.toFixed(4)),
    soloStackingThresholdSTX:  SOLO_STACKING_THRESHOLD_STX,
    requestedCycles,
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=30" },
  });
}
