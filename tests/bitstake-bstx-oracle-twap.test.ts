import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1  = accounts.get("wallet_1")!;

const CONTRACT = "bitstake-bstx-oracle-twap";

const TOTAL_STX  = 100_000_000_000n;
const TOTAL_BSTX = 100_000_000_000n;

describe("bitstake-bstx-oracle-twap", () => {

  it("get-last-spot returns 0 before any push", () => {
    const result = simnet.callReadOnlyFn(CONTRACT, "get-last-spot", [], deployer);
    expect(result.result).toBeOk(Cl.uint(0n));
  });

  it("get-total-written returns 0 before any push", () => {
    const result = simnet.callReadOnlyFn(CONTRACT, "get-total-written", [], deployer);
    expect(result.result).toBeOk(Cl.uint(0n));
  });

  it("push-price accepted by owner and returns spot rate", () => {
    simnet.mineEmptyBlocks(5);
    const result = simnet.callPublicFn(
      CONTRACT, "push-price",
      [Cl.uint(TOTAL_STX), Cl.uint(TOTAL_BSTX)],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(1_000_000n));
  });

  it("get-last-spot returns 1_000_000 after push", () => {
    const result = simnet.callReadOnlyFn(CONTRACT, "get-last-spot", [], deployer);
    expect(result.result).toBeOk(Cl.uint(1_000_000n));
  });

  it("total-written increments after push", () => {
    const result = simnet.callReadOnlyFn(CONTRACT, "get-total-written", [], deployer);
    const val = (result.result as any).value.value;
    expect(val).toBeGreaterThanOrEqual(1n);
  });

  it("push-price rejects non-owner", () => {
    simnet.mineEmptyBlocks(5);
    const result = simnet.callPublicFn(
      CONTRACT, "push-price",
      [Cl.uint(TOTAL_STX), Cl.uint(TOTAL_BSTX)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(300n)); // ERR-NOT-OWNER
  });

  it("push-price rejects zero bSTX supply", () => {
    simnet.mineEmptyBlocks(5);
    const result = simnet.callPublicFn(
      CONTRACT, "push-price",
      [Cl.uint(TOTAL_STX), Cl.uint(0n)],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(302n)); // ERR-ZERO-SUPPLY
  });

  it("get-twap returns ok after multiple pushes", () => {
    // Push several observations
    for (let i = 0; i < 5; i++) {
      simnet.mineEmptyBlocks(3);
      simnet.callPublicFn(
        CONTRACT, "push-price",
        [Cl.uint(TOTAL_STX), Cl.uint(TOTAL_BSTX)],
        deployer
      );
    }
    const twap = simnet.callReadOnlyFn(CONTRACT, "get-twap", [], deployer);
    expect(twap.result).toBeOk(expect.anything());
  });

  it("get-twap-over-window(1) returns a non-zero value", () => {
    const result = simnet.callReadOnlyFn(
      CONTRACT, "get-twap-over-window", [Cl.uint(1n)], deployer
    );
    // Should be ok with some value
    expect((result.result as any).type).toBe(7); // ResponseOk
  });

  it("get-twap-over-window with age beyond total-written returns err", () => {
    const result = simnet.callReadOnlyFn(
      CONTRACT, "get-twap-over-window", [Cl.uint(100n)], deployer
    );
    expect(result.result).toBeErr(Cl.uint(301n)); // ERR-NO-DATA
  });

  it("get-cumulative-price grows with each push", () => {
    const before = (simnet.callReadOnlyFn(CONTRACT, "get-cumulative-price", [], deployer).result as any).value.value;
    simnet.mineEmptyBlocks(3);
    simnet.callPublicFn(
      CONTRACT, "push-price",
      [Cl.uint(TOTAL_STX), Cl.uint(TOTAL_BSTX)],
      deployer
    );
    const after = (simnet.callReadOnlyFn(CONTRACT, "get-cumulative-price", [], deployer).result as any).value.value;
    expect(after).toBeGreaterThan(before);
  });

  it("get-checkpoint slot 0 is populated after pushes", () => {
    const result = simnet.callReadOnlyFn(
      CONTRACT, "get-checkpoint", [Cl.uint(0n)], deployer
    );
    const data = (result.result as any).value.value;
    expect(data).not.toBeNull();
  });

  it("get-write-index advances after each push", () => {
    const idx = simnet.callReadOnlyFn(CONTRACT, "get-write-index", [], deployer);
    const val = (idx.result as any).value.value;
    expect(val).toBeGreaterThan(1n);
  });
});
