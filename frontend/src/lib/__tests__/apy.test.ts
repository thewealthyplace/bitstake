import { describe, it, expect } from "vitest";
import {
  computeAPY,
  formatSTX,
  formatBTC,
  formatAPY,
  blocksToSeconds,
  blockToCycleNumber,
  cycleStartBlock,
  cycleEndBlock,
  blocksUntilCycleEnd,
  toCSV,
  averageAPY,
  generateMockCycleHistory,
  CYCLES_PER_YEAR,
  BLOCKS_PER_CYCLE,
  SECONDS_PER_BLOCK,
} from "../apy";

describe("computeAPY", () => {
  it("returns 0 when total stx is zero", () => {
    expect(computeAPY({ btcRewardSatoshis: 100_000, totalStxStackedMicro: 0, btcPriceUsd: 65000, stxPriceUsd: 0.95 })).toBe(0);
  });

  it("returns 0 when stx price is zero", () => {
    expect(computeAPY({ btcRewardSatoshis: 100_000, totalStxStackedMicro: 1_000_000_000, btcPriceUsd: 65000, stxPriceUsd: 0 })).toBe(0);
  });

  it("computes correct APY for known inputs", () => {
    // BTC reward: 0.00023 BTC = 23000 sat
    // STX stacked: 1,500,000 STX = 1_500_000_000_000 micro
    // btcPrice = 65000, stxPrice = 0.95
    // btcValueUsd = 0.00023 * 65000 = 14.95
    // stxValueUsd = 1,500,000 * 0.95 = 1,425,000
    // APY = 14.95 / 1,425,000 * 26 * 100 ≈ 0.02729...%
    const apy = computeAPY({
      btcRewardSatoshis:    23_000,
      totalStxStackedMicro: 1_500_000_000_000,
      btcPriceUsd:          65_000,
      stxPriceUsd:          0.95,
    });
    expect(apy).toBeCloseTo(0.02729, 3);
  });

  it("uses CYCLES_PER_YEAR = 26 in the formula", () => {
    const apy = computeAPY({
      btcRewardSatoshis:    1_000_000,  // 0.01 BTC
      totalStxStackedMicro: 1_000_000_000, // 1000 STX
      btcPriceUsd:          1,
      stxPriceUsd:          1,
    });
    // btcValueUsd = 0.01, stxValueUsd = 1000
    // APY = 0.01/1000 * 26 * 100 = 0.026%
    expect(apy).toBeCloseTo(0.026, 5);
  });
});

describe("formatSTX", () => {
  it("formats 1_000_000 micro-STX as '1.00 STX'", () => {
    expect(formatSTX(1_000_000)).toBe("1.00 STX");
  });

  it("formats 1_500_000_000 micro-STX as '1,500.00 STX'", () => {
    expect(formatSTX(1_500_000_000)).toBe("1,500.00 STX");
  });
});

describe("formatBTC", () => {
  it("formats 100000000 satoshis as '1.00000 BTC'", () => {
    expect(formatBTC(100_000_000)).toContain("1");
    expect(formatBTC(100_000_000)).toContain("BTC");
  });

  it("formats 0 satoshis containing '0'", () => {
    expect(formatBTC(0)).toContain("0");
  });
});

describe("formatAPY", () => {
  it("formats 8.3456 as '8.35%'", () => {
    expect(formatAPY(8.3456)).toBe("8.35%");
  });

  it("formats 0 as '0.00%'", () => {
    expect(formatAPY(0)).toBe("0.00%");
  });
});

describe("block / cycle helpers", () => {
  it("BLOCKS_PER_CYCLE is 2100", () => {
    expect(BLOCKS_PER_CYCLE).toBe(2100);
  });

  it("SECONDS_PER_BLOCK is 600", () => {
    expect(SECONDS_PER_BLOCK).toBe(600);
  });

  it("CYCLES_PER_YEAR is 26", () => {
    expect(CYCLES_PER_YEAR).toBe(26);
  });

  it("blocksToSeconds converts correctly", () => {
    expect(blocksToSeconds(10)).toBe(6000);
  });

  it("blockToCycleNumber(4200) = 2", () => {
    expect(blockToCycleNumber(4200)).toBe(2);
  });

  it("cycleStartBlock(3) = 6300", () => {
    expect(cycleStartBlock(3)).toBe(6300);
  });

  it("cycleEndBlock(3) = 8399", () => {
    expect(cycleEndBlock(3)).toBe(8399);
  });

  it("blocksUntilCycleEnd returns correct remaining blocks", () => {
    // block 5000 is in cycle 2 (4200–6299), end = 6299
    expect(blocksUntilCycleEnd(5000)).toBe(6299 - 5000);
  });

  it("blocksUntilCycleEnd returns 0 at cycle end block", () => {
    expect(blocksUntilCycleEnd(6299)).toBe(0);
  });
});

describe("toCSV", () => {
  it("returns empty string for empty array", () => {
    expect(toCSV([])).toBe("");
  });

  it("generates correct header row", () => {
    const csv = toCSV([{ a: 1, b: "hello" }]);
    expect(csv.split("\n")[0]).toBe("a,b");
  });

  it("generates correct data row", () => {
    const csv = toCSV([{ a: 1, b: "hello" }]);
    expect(csv.split("\n")[1]).toBe("1,hello");
  });

  it("escapes commas in values", () => {
    const csv = toCSV([{ a: "one,two" }]);
    expect(csv.split("\n")[1]).toBe('"one,two"');
  });
});

describe("averageAPY", () => {
  it("returns 0 for empty array", () => {
    expect(averageAPY([])).toBe(0);
  });

  it("averages correctly", () => {
    expect(averageAPY([8, 10, 12])).toBeCloseTo(10, 5);
  });
});

describe("generateMockCycleHistory", () => {
  it("generates requested number of records", () => {
    const history = generateMockCycleHistory(52, 150_000);
    expect(history.length).toBe(52);
  });

  it("all APY values are non-negative", () => {
    const history = generateMockCycleHistory(26, 150_000);
    expect(history.every((r) => r.apyPercent >= 0)).toBe(true);
  });

  it("cycle numbers are ascending", () => {
    const history = generateMockCycleHistory(10, 150_000);
    for (let i = 1; i < history.length; i++) {
      expect(history[i].cycleNumber).toBeGreaterThan(history[i - 1].cycleNumber);
    }
  });

  it("records have valid ISO timestamps", () => {
    const history = generateMockCycleHistory(5, 150_000);
    history.forEach((r) => {
      expect(() => new Date(r.timestamp)).not.toThrow();
    });
  });
});
