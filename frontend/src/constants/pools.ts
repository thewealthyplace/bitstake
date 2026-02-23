import { STACKS_TESTNET } from "@stacks/network";

export const STACKS_NETWORK = new STACKS_TESTNET();

export const CONTRACT_DEPLOYER = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

export const CONTRACTS = {
  POOL_REGISTRY: `${CONTRACT_DEPLOYER}.bitstake-pool-registry`,
  POOL_DEPOSITS:  `${CONTRACT_DEPLOYER}.bitstake-pool-deposits`,
  LBSTX_TOKEN:   `${CONTRACT_DEPLOYER}.bitstake-lbstx`,
  BBSTX_TOKEN:   `${CONTRACT_DEPLOYER}.bitstake-bbstx`,
  MBSTX_TOKEN:   `${CONTRACT_DEPLOYER}.bitstake-mbstx`,
  REWARDS:       `${CONTRACT_DEPLOYER}.bitstake-rewards`,
};

export interface PoolTier {
  id: number;
  name: string;
  lockupCycles: number;
  lockupDays: number;
  minDepositSTX: number;
  tokenSymbol: string;
  apy: string;        // indicative, fetched from backend
  description: string;
}

export const POOL_TIERS: PoolTier[] = [
  {
    id: 1,
    name: "Liquid",
    lockupCycles: 1,
    lockupDays: 15,
    minDepositSTX: 100,
    tokenSymbol: "lbSTX",
    apy: "~7%",
    description: "Shortest lockup, lower yield. Ideal for flexible stacking.",
  },
  {
    id: 2,
    name: "Balanced",
    lockupCycles: 3,
    lockupDays: 45,
    minDepositSTX: 500,
    tokenSymbol: "bbSTX",
    apy: "~9%",
    description: "Medium-term lockup with moderate yield. Best risk/reward.",
  },
  {
    id: 3,
    name: "Maxi",
    lockupCycles: 12,
    lockupDays: 180,
    minDepositSTX: 1000,
    tokenSymbol: "mbSTX",
    apy: "~13%",
    description: "Long-term lockup, highest yield. For committed stackers.",
  },
];

export const BLOCKS_PER_CYCLE = 2100;
