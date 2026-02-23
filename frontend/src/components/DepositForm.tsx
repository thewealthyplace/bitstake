import React, { useState } from "react";
import { openContractCall } from "@stacks/connect";
import { Cl } from "@stacks/transactions";
import type { PoolData } from "../hooks/usePoolTiers";
import { CONTRACTS, STACKS_NETWORK } from "../constants/pools";

interface DepositFormProps {
  pool: PoolData;
  userAddress: string;
  onSuccess: (amount: bigint) => void;
}

export function DepositForm({ pool, userAddress, onSuccess }: DepositFormProps) {
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const amountSTX = parseFloat(amountStr) || 0;
  const amountMicro = BigInt(Math.floor(amountSTX * 1_000_000));
  const isValid = amountSTX >= pool.minDepositSTX && !isNaN(amountSTX);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setStatus("pending");
    setErrorMsg("");

    const [contractAddress, contractName] = CONTRACTS.POOL_DEPOSITS.split(".");

    try {
      await openContractCall({
        network: STACKS_NETWORK,
        contractAddress,
        contractName,
        functionName: "deposit-to-pool",
        functionArgs: [Cl.uint(pool.id), Cl.uint(amountMicro)],
        postConditionMode: 1,
        onFinish: () => {
          setStatus("success");
          onSuccess(amountMicro);
          setAmountStr("");
        },
        onCancel: () => {
          setStatus("idle");
        },
      });
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message ?? "Transaction failed");
    }
  }

  return (
    <form className="deposit-form" onSubmit={handleDeposit} aria-label="Deposit form">
      <h3 className="deposit-form__title">
        Deposit to {pool.name} Pool ({pool.tokenSymbol})
      </h3>

      <div className="deposit-form__field">
        <label htmlFor="amount" className="deposit-form__label">
          Amount (STX)
        </label>
        <input
          id="amount"
          type="number"
          min={pool.minDepositSTX}
          step="0.000001"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          placeholder={`Min ${pool.minDepositSTX.toLocaleString()} STX`}
          className="deposit-form__input"
          aria-invalid={amountStr !== "" && !isValid}
          disabled={status === "pending"}
        />
        {amountStr !== "" && !isValid && (
          <p className="deposit-form__error" role="alert">
            Minimum deposit is {pool.minDepositSTX.toLocaleString()} STX
          </p>
        )}
      </div>

      <div className="deposit-form__lockup-notice">
        Funds will be locked for ~{pool.lockupDays} days ({pool.lockupCycles}{" "}
        stacking cycle{pool.lockupCycles > 1 ? "s" : ""}).
      </div>

      <button
        type="submit"
        className="deposit-form__submit"
        disabled={!isValid || status === "pending"}
      >
        {status === "pending" ? "Waiting for wallet…" : `Deposit ${amountSTX > 0 ? amountSTX.toLocaleString() + " STX" : ""}`}
      </button>

      {status === "success" && (
        <p className="deposit-form__success" role="status">
          Deposit submitted! You will receive {pool.tokenSymbol} tokens once confirmed.
        </p>
      )}
      {status === "error" && (
        <p className="deposit-form__error" role="alert">{errorMsg}</p>
      )}
    </form>
  );
}
