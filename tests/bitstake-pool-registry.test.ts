import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";
import { initSimnet } from "@hirosystems/clarinet-sdk";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

describe("bitstake-pool-registry", () => {
  it("initialises with 3 default pools", () => {
    const count = simnet.callReadOnlyFn(
      "bitstake-pool-registry",
      "get-pool-count",
      [],
      deployer
    );
    expect(count.result).toBeUint(3);
  });

  it("pool 1 is Liquid with 1 lockup cycle", () => {
    const pool = simnet.callReadOnlyFn(
      "bitstake-pool-registry",
      "get-pool",
      [Cl.uint(1)],
      deployer
    );
    expect(pool.result).toBeSome(
      Cl.tuple({
        name: Cl.stringAscii("Liquid"),
        "lockup-cycles": Cl.uint(1),
        "min-deposit": Cl.uint(100000000),
        "total-stacked": Cl.uint(0),
        active: Cl.bool(true),
        "token-symbol": Cl.stringAscii("lbSTX"),
      })
    );
  });

  it("pool 2 is Balanced with 3 lockup cycles", () => {
    const pool = simnet.callReadOnlyFn(
      "bitstake-pool-registry",
      "get-pool",
      [Cl.uint(2)],
      deployer
    );
    expect(pool.result).toBeSome(
      Cl.tuple({
        name: Cl.stringAscii("Balanced"),
        "lockup-cycles": Cl.uint(3),
        "min-deposit": Cl.uint(500000000),
        "total-stacked": Cl.uint(0),
        active: Cl.bool(true),
        "token-symbol": Cl.stringAscii("bbSTX"),
      })
    );
  });

  it("pool 3 is Maxi with 12 lockup cycles", () => {
    const pool = simnet.callReadOnlyFn(
      "bitstake-pool-registry",
      "get-pool",
      [Cl.uint(3)],
      deployer
    );
    expect(pool.result).toBeSome(
      Cl.tuple({
        name: Cl.stringAscii("Maxi"),
        "lockup-cycles": Cl.uint(12),
        "min-deposit": Cl.uint(1000000000),
        "total-stacked": Cl.uint(0),
        active: Cl.bool(true),
        "token-symbol": Cl.stringAscii("mbSTX"),
      })
    );
  });

  it("non-owner cannot create a new pool", () => {
    const result = simnet.callPublicFn(
      "bitstake-pool-registry",
      "create-pool",
      [
        Cl.stringAscii("Elite"),
        Cl.uint(24),
        Cl.uint(5000000000),
        Cl.stringAscii("ebSTX"),
      ],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(100));
  });

  it("owner can deactivate a pool", () => {
    simnet.callPublicFn(
      "bitstake-pool-registry",
      "set-pool-active",
      [Cl.uint(1), Cl.bool(false)],
      deployer
    );
    const active = simnet.callReadOnlyFn(
      "bitstake-pool-registry",
      "is-pool-active",
      [Cl.uint(1)],
      deployer
    );
    expect(active.result).toBeOk(Cl.bool(false));
  });

  it("returns false for non-existent pool active check", () => {
    const active = simnet.callReadOnlyFn(
      "bitstake-pool-registry",
      "is-pool-active",
      [Cl.uint(99)],
      deployer
    );
    expect(active.result).toBeOk(Cl.bool(false));
  });

  it("returns pool-not-found for unknown pool get-min-deposit", () => {
    const min = simnet.callReadOnlyFn(
      "bitstake-pool-registry",
      "get-min-deposit",
      [Cl.uint(99)],
      deployer
    );
    expect(min.result).toBeErr(Cl.uint(101));
  });
});
