import { useState, useEffect } from "react";
import { cvToValue, fetchReadOnlyFunction } from "@stacks/transactions";
import { CONTRACTS, POOL_TIERS, STACKS_NETWORK, type PoolTier } from "../constants/pools";

export interface PoolData extends PoolTier {
  totalStacked: bigint;
  active: boolean;
  isLoading: boolean;
}

export function usePoolTiers(): { pools: PoolData[]; isLoading: boolean; refetch: () => void } {
  const [pools, setPools] = useState<PoolData[]>(
    POOL_TIERS.map((t) => ({ ...t, totalStacked: 0n, active: true, isLoading: true }))
  );
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setIsLoading(true);
      const [registryAddress, registryName] = CONTRACTS.POOL_REGISTRY.split(".");

      const updated = await Promise.all(
        POOL_TIERS.map(async (tier) => {
          try {
            const result = await fetchReadOnlyFunction(
              {
                contractAddress: registryAddress,
                contractName: registryName,
                functionName: "get-pool",
                functionArgs: [{ type: "uint", value: BigInt(tier.id) }],
                network: STACKS_NETWORK,
              },
              true
            );
            const data = cvToValue(result as any);
            return {
              ...tier,
              totalStacked: BigInt(data?.value?.["total-stacked"] ?? 0),
              active: Boolean(data?.value?.active),
              isLoading: false,
            };
          } catch {
            return { ...tier, totalStacked: 0n, active: true, isLoading: false };
          }
        })
      );

      if (!cancelled) {
        setPools(updated);
        setIsLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [tick]);

  return { pools, isLoading, refetch: () => setTick((t) => t + 1) };
}
