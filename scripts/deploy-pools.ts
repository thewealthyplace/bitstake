#!/usr/bin/env ts-node
/**
 * deploy-pools.ts
 * Deploy all bitstake pool contracts to Stacks testnet.
 * Usage: DEPLOYER_KEY=<hex-private-key> ts-node scripts/deploy-pools.ts
 */

import {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
} from "@stacks/transactions";
import { StacksTestnet } from "@stacks/network";
import { readFileSync } from "fs";
import { resolve } from "path";

const network = new StacksTestnet();
const senderKey = process.env.DEPLOYER_KEY;
if (!senderKey) {
  console.error("ERROR: DEPLOYER_KEY environment variable is required");
  process.exit(1);
}

interface ContractDef {
  name: string;
  file: string;
}

const CONTRACTS: ContractDef[] = [
  { name: "bitstake-pool-registry", file: "contracts/bitstake-pool-registry.clar" },
  { name: "bitstake-pool-deposits", file: "contracts/bitstake-pool-deposits.clar" },
  { name: "bitstake-lbstx",         file: "contracts/bitstake-lbstx.clar" },
  { name: "bitstake-bbstx",         file: "contracts/bitstake-bbstx.clar" },
  { name: "bitstake-mbstx",         file: "contracts/bitstake-mbstx.clar" },
  { name: "bitstake-rewards",        file: "contracts/bitstake-rewards.clar" },
];

async function deploy(contract: ContractDef, nonce: bigint): Promise<string> {
  const code = readFileSync(resolve(__dirname, "..", contract.file), "utf8");
  const tx = await makeContractDeploy({
    contractName: contract.name,
    codeBody: code,
    senderKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    nonce,
    fee: 10_000n,
  });
  const result = await broadcastTransaction({ transaction: tx, network });
  if ("error" in result) {
    throw new Error(`Deploy failed for ${contract.name}: ${result.error} — ${result.reason}`);
  }
  return result.txid;
}

async function main() {
  console.log("🚀 Deploying bitstake pool contracts to testnet…\n");
  let nonce = 0n;

  for (const contract of CONTRACTS) {
    process.stdout.write(`  Deploying ${contract.name}… `);
    try {
      const txid = await deploy(contract, nonce);
      console.log(`✅ txid: ${txid}`);
      nonce++;
      // small delay between deploys
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err: any) {
      console.error(`\n  ❌ ${err.message}`);
      process.exit(1);
    }
  }

  console.log("\n✅ All contracts deployed successfully.");
}

main();
