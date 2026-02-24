import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1  = accounts.get("wallet_1")!;
const wallet2  = accounts.get("wallet_2")!;

const CONTRACT = "bitstake-bitflow-pool";

// 1000 STX in micros
const STX_1K  = 1_000_000_000n;
// 1000 bSTX in micros
const BSTX_1K = 1_000_000_000n;

describe("bitstake-bitflow-pool", () => {

  it("initial pool stats show zero reserves and no positions", () => {
    const stats = simnet.callReadOnlyFn(CONTRACT, "get-pool-stats", [], deployer);
    const data = (stats.result as any).value.data;
    expect(data.active.value).toBe(true);
    expect(data["reserve-bstx"].value).toBe(0n);
    expect(data["reserve-stx"].value).toBe(0n);
    expect(data["total-liquidity"].value).toBe(0n);
    expect(data["position-count"].value).toBe(0n);
  });

  it("initial current price is set to 1.01 * PRECISION", () => {
    const stats = simnet.callReadOnlyFn(CONTRACT, "get-pool-stats", [], deployer);
    const price = (stats.result as any).value.data["current-price"].value;
    expect(price).toBe(1_010_000n);
  });

  it("add-liquidity succeeds with valid amounts", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "add-liquidity",
      [Cl.uint(BSTX_1K), Cl.uint(STX_1K), Cl.uint(BSTX_1K), Cl.uint(STX_1K)],
      wallet1
    );
    expect(result.result).toBeOk(Cl.uint(1n));
  });

  it("pool reserves updated after adding liquidity", () => {
    const stats = simnet.callReadOnlyFn(CONTRACT, "get-pool-stats", [], deployer);
    const data = (stats.result as any).value.data;
    expect(data["reserve-stx"].value).toBe(STX_1K);
    expect(data["reserve-bstx"].value).toBe(BSTX_1K);
  });

  it("position is recorded correctly after add-liquidity", () => {
    const pos = simnet.callReadOnlyFn(
      CONTRACT, "get-position", [Cl.uint(1n)], deployer
    );
    const data = (pos.result as any).value.value.data;
    expect(data.provider.value).toBe(wallet1);
    expect(data["bstx-amount"].value).toBe(BSTX_1K);
    expect(data["stx-amount"].value).toBe(STX_1K);
  });

  it("add-liquidity rejects zero bSTX amount", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "add-liquidity",
      [Cl.uint(0n), Cl.uint(STX_1K), Cl.uint(0n), Cl.uint(STX_1K)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(601n)); // ERR-ZERO-AMOUNT
  });

  it("add-liquidity rejects when slippage check fails", () => {
    // Require more than we provide
    const result = simnet.callPublicFn(
      CONTRACT,
      "add-liquidity",
      [Cl.uint(BSTX_1K), Cl.uint(STX_1K), Cl.uint(BSTX_1K * 2n), Cl.uint(STX_1K)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(605n)); // ERR-SLIPPAGE
  });

  it("add-liquidity rejected when pool is paused", () => {
    simnet.callPublicFn(
      CONTRACT, "set-pool-active", [Cl.bool(false)], deployer
    );
    const result = simnet.callPublicFn(
      CONTRACT,
      "add-liquidity",
      [Cl.uint(BSTX_1K), Cl.uint(STX_1K), Cl.uint(BSTX_1K), Cl.uint(STX_1K)],
      wallet2
    );
    expect(result.result).toBeErr(Cl.uint(604n)); // ERR-POOL-PAUSED
    simnet.callPublicFn(CONTRACT, "set-pool-active", [Cl.bool(true)], deployer);
  });

  it("remove-liquidity fails for non-owner of position", () => {
    const result = simnet.callPublicFn(
      CONTRACT, "remove-liquidity", [Cl.uint(1n)], wallet2  // wallet2 didn't deposit
    );
    expect(result.result).toBeErr(Cl.uint(600n)); // ERR-NOT-OWNER
  });

  it("swap-stx-for-bstx succeeds with sufficient reserves", () => {
    const STX_IN = 500_000_000n; // 500 STX
    const result = simnet.callPublicFn(
      CONTRACT,
      "swap-stx-for-bstx",
      [Cl.uint(STX_IN), Cl.uint(0n)], // min-bstx-out = 0 (no slippage guard in test)
      wallet2
    );
    expect(result.result).toBeOk(expect.anything());
  });

  it("quote-stx-for-bstx returns a non-zero estimate", () => {
    const result = simnet.callReadOnlyFn(
      CONTRACT, "quote-stx-for-bstx", [Cl.uint(1_000_000_000n)], deployer
    );
    const data = (result.result as any).value.data;
    expect(data["bstx-out"].value).toBeGreaterThan(0n);
    expect(data.fee.value).toBeGreaterThan(0n);
  });

  it("update-price rejects price outside tick range", () => {
    // tick-lower = 950_000, tick-upper = 1_050_000
    const result = simnet.callPublicFn(
      CONTRACT, "update-price", [Cl.uint(1_100_000n)], deployer
    );
    expect(result.result).toBeErr(Cl.uint(607n)); // ERR-INVALID-TICK
  });

  it("update-price accepts price within tick range", () => {
    const result = simnet.callPublicFn(
      CONTRACT, "update-price", [Cl.uint(1_020_000n)], deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("get-position returns none for non-existent position id", () => {
    const result = simnet.callReadOnlyFn(
      CONTRACT, "get-position", [Cl.uint(999n)], deployer
    );
    expect(result.result).toBeOk(Cl.none());
  });
});
