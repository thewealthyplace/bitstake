import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1  = accounts.get("wallet_1")!;

const CONTRACT = "bitstake-oracle-circuit-breaker";

describe("bitstake-oracle-circuit-breaker", () => {

  it("initial status shows breaker closed", () => {
    const status = simnet.callReadOnlyFn(CONTRACT, "get-status", [], deployer);
    const data = (status.result as any).value.data;
    expect(data.open.value).toBe(false);
  });

  it("validate-price accepts a reasonable first price", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "validate-price",
      [Cl.uint(1_000_000n)],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(1_000_000n));
  });

  it("validate-price accepts a price within deviation threshold", () => {
    // Previous price 1_000_000, new price 1_030_000 = 3% deviation (< 5%)
    const result = simnet.callPublicFn(
      CONTRACT,
      "validate-price",
      [Cl.uint(1_030_000n)],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(1_030_000n));
  });

  it("validate-price rejects a price exceeding deviation threshold", () => {
    // Previous accepted price ~1_030_000; jump to 1_200_000 = ~16.5% deviation > 5%
    const result = simnet.callPublicFn(
      CONTRACT,
      "validate-price",
      [Cl.uint(1_200_000n)],
      deployer
    );
    // Should trip breaker and return err u402
    expect(result.result).toBeErr(Cl.uint(402n));
  });

  it("breaker is open after trip", () => {
    const open = simnet.callReadOnlyFn(CONTRACT, "is-open", [], deployer);
    expect(open.result).toBeOk(Cl.bool(true));
  });

  it("validate-price rejected while breaker is open", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "validate-price",
      [Cl.uint(1_000_000n)],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(401n)); // ERR-BREAKER-OPEN
  });

  it("reset-breaker closes the circuit breaker", () => {
    simnet.callPublicFn(CONTRACT, "reset-breaker", [], deployer);
    const open = simnet.callReadOnlyFn(CONTRACT, "is-open", [], deployer);
    expect(open.result).toBeOk(Cl.bool(false));
  });

  it("reset-breaker is rejected by non-owner", () => {
    const result = simnet.callPublicFn(CONTRACT, "reset-breaker", [], wallet1);
    expect(result.result).toBeErr(Cl.uint(400n)); // ERR-NOT-OWNER
  });

  it("trip-breaker can be called manually by owner", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "trip-breaker",
      [Cl.stringAscii("manual-emergency-stop")],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
    // Confirm it's open
    const open = simnet.callReadOnlyFn(CONTRACT, "is-open", [], deployer);
    expect(open.result).toBeOk(Cl.bool(true));
    // Reset for remaining tests
    simnet.callPublicFn(CONTRACT, "reset-breaker", [], deployer);
  });

  it("set-deviation-threshold rejects zero value", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "set-deviation-threshold",
      [Cl.uint(0n)],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(404n)); // ERR-INVALID-PARAMS
  });

  it("set-deviation-threshold rejects value above 5000 bps", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "set-deviation-threshold",
      [Cl.uint(6000n)],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(404n));
  });

  it("set-deviation-threshold accepts valid value", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "set-deviation-threshold",
      [Cl.uint(1000n)],  // 10%
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("get-last-price returns last accepted price", () => {
    const result = simnet.callReadOnlyFn(CONTRACT, "get-last-price", [], deployer);
    // last accepted price was 1_030_000
    expect(result.result).toBeOk(Cl.uint(1_030_000n));
  });

  it("validate-price rejected by non-owner", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "validate-price",
      [Cl.uint(1_000_000n)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(400n));
  });
});
