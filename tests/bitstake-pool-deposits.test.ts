import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const POOL_LIQUID   = 1n;
const POOL_BALANCED = 2n;
const POOL_MAXI     = 3n;

describe("bitstake-pool-deposits", () => {
  it("rejects deposit below minimum for Pool 1 (100 STX)", () => {
    const result = simnet.callPublicFn(
      "bitstake-pool-deposits",
      "deposit-to-pool",
      [Cl.uint(POOL_LIQUID), Cl.uint(50_000_000)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(103));
  });

  it("accepts deposit at exactly minimum for Pool 1", () => {
    const result = simnet.callPublicFn(
      "bitstake-pool-deposits",
      "deposit-to-pool",
      [Cl.uint(POOL_LIQUID), Cl.uint(100_000_000)],
      wallet1
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("records correct position after deposit", () => {
    simnet.callPublicFn(
      "bitstake-pool-deposits",
      "deposit-to-pool",
      [Cl.uint(POOL_LIQUID), Cl.uint(200_000_000)],
      wallet2
    );
    const pos = simnet.callReadOnlyFn(
      "bitstake-pool-deposits",
      "get-position",
      [Cl.uint(POOL_LIQUID), Cl.principal(wallet2)],
      deployer
    );
    expect(pos.result).toBeOk(
      Cl.some(
        Cl.tuple({
          amount: Cl.uint(200_000_000),
          "deposited-at": Cl.uint(simnet.blockHeight),
          "unlock-block": Cl.uint(simnet.blockHeight + 2100),
        })
      )
    );
  });

  it("adds to existing position on second deposit", () => {
    simnet.callPublicFn(
      "bitstake-pool-deposits",
      "deposit-to-pool",
      [Cl.uint(POOL_LIQUID), Cl.uint(100_000_000)],
      wallet1
    );
    simnet.callPublicFn(
      "bitstake-pool-deposits",
      "deposit-to-pool",
      [Cl.uint(POOL_LIQUID), Cl.uint(100_000_000)],
      wallet1
    );
    const pos = simnet.callReadOnlyFn(
      "bitstake-pool-deposits",
      "get-position",
      [Cl.uint(POOL_LIQUID), Cl.principal(wallet1)],
      deployer
    );
    // Total should be 200 STX
    const data = pos.result as any;
    expect(data.value.data.amount.value).toBe(200_000_000n);
  });

  it("blocks withdrawal before unlock-block", () => {
    simnet.callPublicFn(
      "bitstake-pool-deposits",
      "deposit-to-pool",
      [Cl.uint(POOL_LIQUID), Cl.uint(100_000_000)],
      wallet2
    );
    const result = simnet.callPublicFn(
      "bitstake-pool-deposits",
      "withdraw-from-pool",
      [Cl.uint(POOL_LIQUID)],
      wallet2
    );
    expect(result.result).toBeErr(Cl.uint(106));
  });

  it("returns ERR-NO-POSITION when withdrawing without a deposit", () => {
    const result = simnet.callPublicFn(
      "bitstake-pool-deposits",
      "withdraw-from-pool",
      [Cl.uint(POOL_MAXI)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(105));
  });

  it("is-locked returns false when no position exists", () => {
    const result = simnet.callReadOnlyFn(
      "bitstake-pool-deposits",
      "is-locked",
      [Cl.uint(POOL_BALANCED), Cl.principal(wallet1)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(false));
  });

  it("blocks-until-unlock returns 0 when no position", () => {
    const result = simnet.callReadOnlyFn(
      "bitstake-pool-deposits",
      "blocks-until-unlock",
      [Cl.uint(POOL_MAXI), Cl.principal(wallet2)],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(0));
  });

  it("rejects deposit to inactive pool", () => {
    // Deactivate Pool 1 via registry
    simnet.callPublicFn(
      "bitstake-pool-registry",
      "set-pool-active",
      [Cl.uint(POOL_LIQUID), Cl.bool(false)],
      deployer
    );
    const result = simnet.callPublicFn(
      "bitstake-pool-deposits",
      "deposit-to-pool",
      [Cl.uint(POOL_LIQUID), Cl.uint(100_000_000)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(102));
  });
});
