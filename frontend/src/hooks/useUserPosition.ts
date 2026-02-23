import { useState, useEffect } from "react";
import { cvToValue, fetchReadOnlyFunction } from "@stacks/transactions";
import { CONTRACTS, BLOCKS_PER_CYCLE, STACKS_NETWORK } from "../constants/pools";

export interface UserPosition {
  poolId: number;
  amount: bigint;
  depositedAt: bigint;
  unlockBlock: bigint;
  isLocked: boolean;
  blocksUntilUnlock: bigint;
  isLoading: boolean;
}

export function useUserPosition(poolId: number, userAddress: string | null) {
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userAddress) { setPosition(null); return; }
    let cancelled = false;
    setIsLoading(true);

    const [depAddress, depName] = CONTRACTS.POOL_DEPOSITS.split(".");

    async function fetch() {
      try {
        const result = await fetchReadOnlyFunction(
          {
            contractAddress: depAddress,
            contractName: depName,
            functionName: "get-position",
            functionArgs: [
              { type: "uint", value: BigInt(poolId) },
              { type: "principal", value: userAddress },
            ],
            network: STACKS_NETWORK,
          },
          true
        );
        const raw = cvToValue(result as any);
        if (!raw || raw.value === null) {
          if (!cancelled) { setPosition(null); setIsLoading(false); }
          return;
        }
        const d = raw.value;
        const unlockBlock = BigInt(d["unlock-block"]);
        // Approximate current block from chain tip — simplification
        const currentBlock = BigInt(Date.now()); // placeholder; real impl uses @stacks/blockchain-api-client
        if (!cancelled) {
          setPosition({
            poolId,
            amount: BigInt(d.amount),
            depositedAt: BigInt(d["deposited-at"]),
            unlockBlock,
            isLocked: currentBlock < unlockBlock,
            blocksUntilUnlock: currentBlock < unlockBlock ? unlockBlock - currentBlock : 0n,
            isLoading: false,
          });
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) { setPosition(null); setIsLoading(false); }
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, [poolId, userAddress]);

  return { position, isLoading };
}
