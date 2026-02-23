import React, { useState } from "react";
import { usePoolTiers } from "../hooks/usePoolTiers";
import { PoolTierCard } from "./PoolTierCard";
import { DepositForm } from "./DepositForm";

interface PoolSelectorProps {
  userAddress: string | null;
  onDepositSuccess?: (poolId: number, amount: bigint) => void;
}

export function PoolSelector({ userAddress, onDepositSuccess }: PoolSelectorProps) {
  const { pools, isLoading, refetch } = usePoolTiers();
  const [selectedPoolId, setSelectedPoolId] = useState<number | null>(null);

  const selectedPool = pools.find((p) => p.id === selectedPoolId) ?? null;

  return (
    <section className="pool-selector" aria-label="Pool tier selection">
      <h2 className="pool-selector__title">Choose Your Stacking Pool</h2>
      <p className="pool-selector__subtitle">
        Select a pool tier that matches your lockup preference and yield target.
      </p>

      {isLoading ? (
        <div className="pool-selector__loading" aria-busy="true">
          Loading pools…
        </div>
      ) : (
        <div className="pool-selector__grid">
          {pools.map((pool) => (
            <PoolTierCard
              key={pool.id}
              pool={pool}
              onSelect={setSelectedPoolId}
              selected={selectedPoolId === pool.id}
            />
          ))}
        </div>
      )}

      {selectedPool && userAddress && (
        <DepositForm
          pool={selectedPool}
          userAddress={userAddress}
          onSuccess={(amount) => {
            refetch();
            onDepositSuccess?.(selectedPool.id, amount);
          }}
        />
      )}

      {selectedPool && !userAddress && (
        <p className="pool-selector__connect-prompt">
          Connect your wallet to deposit into the {selectedPool.name} pool.
        </p>
      )}
    </section>
  );
}
