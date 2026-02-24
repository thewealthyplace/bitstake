import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1  = accounts.get("wallet_1")!;

const CONTRACT = "bitstake-bstx-oracle";

// 100_000 STX stacked, 100_000 bSTX minted → rate = 1_000_000 (1:1)
const TOTAL_STX   = 100_000_000_000n; // 100,000 STX in micros
const TOTAL_BSTX  = 100_000_000_000n;

describe("bitstake-bstx-oracle", () => {

  it("compute-spot-rate returns 1_000_000 for equal totals", () => {
    const result = simnet.callReadOnlyFn(
      CONTRACT,
      "compute-spot-rate",
      [Cl.uint(TOTAL_STX), Cl.uint(TOTAL_BSTX)],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(1_000_000n));
  });

  it("compute-spot-rate returns premium when STX > bSTX supply", () => {
    // 110k STX / 100k bSTX → 1.10 → 1_100_000
    const result = simnet.callReadOnlyFn(
      CONTRACT,
      "compute-spot-rate",
      [Cl.uint(110_000_000_000n), Cl.uint(100_000_000_000n)],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(1_100_000n));
  });

  it("compute-spot-rate errors when bSTX supply is zero", () => {
    const result = simnet.callReadOnlyFn(
      CONTRACT,
      "compute-spot-rate",
      [Cl.uint(TOTAL_STX), Cl.uint(0n)],
      deployer
    );
    // ERR-ZERO-SUPPLY = err u201
    expect(result.result).toBeErr(Cl.uint(201n));
  });

  it("record-observation succeeds on first call", () => {
    // Mine 5+ blocks so MIN-OBSERVATION-GAP is satisfied
    simnet.mineEmptyBlocks(10);
    const result = simnet.callPublicFn(
      CONTRACT,
      "record-observation",
      [Cl.uint(TOTAL_STX), Cl.uint(TOTAL_BSTX)],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(1_000_000n));
  });

  it("get-spot-rate returns last recorded rate", () => {
    const rate = simnet.callReadOnlyFn(CONTRACT, "get-spot-rate", [], deployer);
    expect(rate.result).toBeOk(Cl.uint(1_000_000n));
  });

  it("get-observation-count increments after recording", () => {
    const count = simnet.callReadOnlyFn(CONTRACT, "get-observation-count", [], deployer);
    // At least 1 after the previous test
    const val = (count.result as any).value.value;
    expect(val).toBeGreaterThanOrEqual(1n);
  });

  it("record-observation rejects when called too frequently", () => {
    // Should fail — gap < MIN-OBSERVATION-GAP (5 blocks)
    const result = simnet.callPublicFn(
      CONTRACT,
      "record-observation",
      [Cl.uint(TOTAL_STX), Cl.uint(TOTAL_BSTX)],
      deployer
    );
    // ERR-TOO-FREQUENT = err u203
    expect(result.result).toBeErr(Cl.uint(203n));
  });

  it("record-observation is rejected by non-owner", () => {
    simnet.mineEmptyBlocks(10);
    const result = simnet.callPublicFn(
      CONTRACT,
      "record-observation",
      [Cl.uint(TOTAL_STX), Cl.uint(TOTAL_BSTX)],
      wallet1   // not the owner
    );
    expect(result.result).toBeErr(Cl.uint(200n)); // ERR-NOT-OWNER
  });

  it("get-twap returns ok after sufficient observations", () => {
    // Record several more observations
    for (let i = 0; i < 3; i++) {
      simnet.mineEmptyBlocks(10);
      simnet.callPublicFn(
        CONTRACT,
        "record-observation",
        [Cl.uint(TOTAL_STX), Cl.uint(TOTAL_BSTX)],
        deployer
      );
    }
    const twap = simnet.callReadOnlyFn(CONTRACT, "get-twap", [], deployer);
    expect(twap.result).toBeOk(Cl.uint(1_000_000n));
  });

  it("set-authorized-updater allows non-owner to record", () => {
    simnet.callPublicFn(
      CONTRACT,
      "set-authorized-updater",
      [Cl.some(Cl.principal(wallet1))],
      deployer
    );
    simnet.mineEmptyBlocks(10);
    const result = simnet.callPublicFn(
      CONTRACT,
      "record-observation",
      [Cl.uint(TOTAL_STX), Cl.uint(TOTAL_BSTX)],
      wallet1
    );
    expect(result.result).toBeOk(Cl.uint(1_000_000n));
  });

  it("reset-circuit-breaker can only be called by owner", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "reset-circuit-breaker",
      [],
      wallet1  // not owner
    );
    expect(result.result).toBeErr(Cl.uint(200n));
  });

  it("is-halted returns false when circuit breaker is not tripped", () => {
    const result = simnet.callReadOnlyFn(CONTRACT, "is-halted", [], deployer);
    expect(result.result).toBeOk(Cl.bool(false));
  });

  it("get-rates returns combined state snapshot", () => {
    const result = simnet.callReadOnlyFn(CONTRACT, "get-rates", [], deployer);
    expect(result.result).toBeOk(
      expect.objectContaining({})
    );
  });
});
