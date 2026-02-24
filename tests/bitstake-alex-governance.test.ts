import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer  = accounts.get("deployer")!;
const wallet1   = accounts.get("wallet_1")!;
const wallet2   = accounts.get("wallet_2")!;

const CONTRACT = "bitstake-alex-governance";

// Status constants
const STATUS_DRAFT     = 0n;
const STATUS_SUBMITTED = 1n;
const STATUS_ACTIVE    = 2n;
const STATUS_PASSED    = 3n;
const STATUS_REJECTED  = 4n;

describe("bitstake-alex-governance", () => {

  it("seeds a default proposal at deploy (id=1)", () => {
    const count = simnet.callReadOnlyFn(CONTRACT, "get-proposal-count", [], deployer);
    expect(count.result).toBeOk(Cl.uint(1n));
  });

  it("default proposal has DRAFT status", () => {
    const p = simnet.callReadOnlyFn(CONTRACT, "get-proposal", [Cl.uint(1n)], deployer);
    const data = (p.result as any).value.value.data;
    expect(data.status.value).toBe(STATUS_DRAFT);
  });

  it("default proposal has correct LTV params", () => {
    const p = simnet.callReadOnlyFn(CONTRACT, "get-proposal", [Cl.uint(1n)], deployer);
    const data = (p.result as any).value.value.data;
    expect(data["ltv-bps"].value).toBe(7500n);
    expect(data["liquidation-threshold"].value).toBe(8000n);
    expect(data["liquidation-bonus"].value).toBe(500n);
  });

  it("get-default-params returns expected values", () => {
    const result = simnet.callReadOnlyFn(CONTRACT, "get-default-params", [], deployer);
    const data = (result.result as any).value.data;
    expect(data["ltv-bps"].value).toBe(7500n);
    expect(data["liquidation-threshold"].value).toBe(8000n);
    expect(data["liquidation-bonus"].value).toBe(500n);
  });

  it("creates a new proposal successfully", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "create-proposal",
      [
        Cl.stringAscii("bSTX Collateral on ALEX v2"),
        Cl.stringAscii("Updated proposal with lower LTV for safety."),
        Cl.principal(deployer),
        Cl.principal(deployer),
        Cl.uint(7000n),  // 70% LTV
        Cl.uint(7800n),  // 78% liquidation threshold
        Cl.uint(400n),   // 4% liquidation bonus
      ],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(2n));
  });

  it("create-proposal rejected by non-owner", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "create-proposal",
      [
        Cl.stringAscii("Unauthorized proposal"),
        Cl.stringAscii("Should be rejected"),
        Cl.principal(wallet1),
        Cl.principal(wallet1),
        Cl.uint(6000n),
        Cl.uint(7000n),
        Cl.uint(300n),
      ],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(500n)); // ERR-NOT-OWNER
  });

  it("create-proposal rejects invalid LTV (threshold <= LTV)", () => {
    const result = simnet.callPublicFn(
      CONTRACT,
      "create-proposal",
      [
        Cl.stringAscii("Bad params"),
        Cl.stringAscii("Threshold equals LTV — invalid"),
        Cl.principal(deployer),
        Cl.principal(deployer),
        Cl.uint(8000n),
        Cl.uint(8000n), // threshold must be > ltv
        Cl.uint(500n),
      ],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(504n)); // ERR-INVALID-PARAMS
  });

  it("transitions proposal from DRAFT to SUBMITTED", () => {
    simnet.callPublicFn(
      CONTRACT, "transition-status",
      [Cl.uint(1n), Cl.uint(Number(STATUS_SUBMITTED))],
      deployer
    );
    const p = simnet.callReadOnlyFn(CONTRACT, "get-proposal", [Cl.uint(1n)], deployer);
    const status = (p.result as any).value.value.data.status.value;
    expect(status).toBe(STATUS_SUBMITTED);
  });

  it("transitions proposal from SUBMITTED to ACTIVE", () => {
    simnet.callPublicFn(
      CONTRACT, "transition-status",
      [Cl.uint(1n), Cl.uint(Number(STATUS_ACTIVE))],
      deployer
    );
    const p = simnet.callReadOnlyFn(CONTRACT, "get-proposal", [Cl.uint(1n)], deployer);
    const status = (p.result as any).value.value.data.status.value;
    expect(status).toBe(STATUS_ACTIVE);
  });

  it("cast-vote records a for-vote on an active proposal", () => {
    simnet.callPublicFn(
      CONTRACT, "cast-vote",
      [Cl.uint(1n), Cl.bool(true)],
      wallet1
    );
    const vote = simnet.callReadOnlyFn(
      CONTRACT, "get-vote",
      [Cl.uint(1n), Cl.principal(wallet1)],
      deployer
    );
    expect(vote.result).toBeOk(Cl.some(Cl.bool(true)));
  });

  it("cast-vote records an against-vote", () => {
    simnet.callPublicFn(
      CONTRACT, "cast-vote",
      [Cl.uint(1n), Cl.bool(false)],
      wallet2
    );
    const vote = simnet.callReadOnlyFn(
      CONTRACT, "get-vote",
      [Cl.uint(1n), Cl.principal(wallet2)],
      deployer
    );
    expect(vote.result).toBeOk(Cl.some(Cl.bool(false)));
  });

  it("cast-vote rejects duplicate vote", () => {
    const result = simnet.callPublicFn(
      CONTRACT, "cast-vote",
      [Cl.uint(1n), Cl.bool(true)],
      wallet1   // already voted
    );
    expect(result.result).toBeErr(Cl.uint(503n)); // ERR-DUPLICATE
  });

  it("invalid status transition is rejected (DRAFT → ACTIVE skips SUBMITTED)", () => {
    const result = simnet.callPublicFn(
      CONTRACT, "transition-status",
      [Cl.uint(2n), Cl.uint(Number(STATUS_ACTIVE))],   // proposal 2 is still DRAFT
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(501n)); // ERR-INVALID-TRANSITION
  });

  it("transitions ACTIVE proposal to PASSED", () => {
    simnet.callPublicFn(
      CONTRACT, "transition-status",
      [Cl.uint(1n), Cl.uint(Number(STATUS_PASSED))],
      deployer
    );
    const p = simnet.callReadOnlyFn(CONTRACT, "get-proposal", [Cl.uint(1n)], deployer);
    const status = (p.result as any).value.value.data.status.value;
    expect(status).toBe(STATUS_PASSED);
  });
});
