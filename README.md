# bitstake

> Automated STX stacking optimizer for maximum Bitcoin yield on Stacks

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Stacks](https://img.shields.io/badge/Built%20on-Stacks-5546FF)](https://stacks.co)
[![Clarity](https://img.shields.io/badge/Language-Clarity-orange)](https://clarity-lang.org)
[![Bitcoin](https://img.shields.io/badge/Earns-Bitcoin-F7931A)](https://bitcoin.org)

## Overview

**bitstake** is an automated yield optimization protocol for STX holders on the Stacks blockchain. By participating in Stacks' Proof-of-Transfer (PoX) mechanism, STX holders earn native Bitcoin rewards. bitstake automates the entire process — pool management, cycle timing, reward distribution, and compounding — so you earn more BTC with zero manual effort.

Stack smarter. Earn Bitcoin. Stay in control.

---

## Features

- **Auto-Stacking** — automatically re-stacks your STX each cycle without manual intervention
- **Pool Aggregation** — pools small STX holders together to meet the dynamic stacking minimum
- **Reward Distribution** — distributes earned BTC proportionally to all pool participants
- **Yield Analytics** — real-time APY tracking and historical reward dashboard
- **Flexible Lockup** — choose 1–12 cycle lockup periods to match your liquidity needs
- **Liquid Stacking Token** — receive `bSTX` (liquid staking token) redeemable 1:1 for STX after unlock
- **Emergency Unstacking** — exit queue mechanism for early unstacking requests
- **Non-Custodial** — you hold your keys; bitstake never takes custody of your STX

---

## How Stacks Stacking Works

```
STX Holder → Locks STX for N cycles → Bitcoin address registered
Miners pay BTC to stack participants → BTC distributed pro-rata
Cycle ends → STX unlocked → repeat
```

Each Stacks cycle is ~2 weeks. bitstake handles the timing, registration, and BTC claims automatically.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Clarity (Stacks) |
| Stacking Protocol | Stacks PoX-4 |
| Frontend | Next.js 14 + TypeScript |
| Blockchain SDK | Stacks.js |
| BTC Distribution | Bitcoin script + Clarity |
| Price Oracle | Pyth Network on Stacks |
| Testing | Clarinet + Vitest |
| Indexing | Hiro API + custom indexer |

---

## Architecture

```
bitstake/
├── contracts/
│   ├── bitstake-pool.clar         # Core pool and stacking logic
│   ├── bitstake-token.clar        # bSTX liquid staking token (SIP-010)
│   ├── bitstake-rewards.clar      # BTC reward distribution
│   ├── bitstake-oracle.clar       # Price feed integration
│   └── traits/
│       ├── pool-trait.clar
│       └── reward-trait.clar
├── frontend/
│   ├── app/
│   │   ├── dashboard/
│   │   ├── stake/
│   │   └── rewards/
│   └── components/
├── indexer/
│   ├── cycle-watcher.ts
│   └── reward-claimer.ts
├── tests/
│   ├── pool.test.ts
│   └── rewards.test.ts
└── scripts/
    ├── register-pool.ts
    └── claim-rewards.ts
```

---

## Smart Contract Interface

### Deposit STX into Pool
```clarity
(contract-call? .bitstake-pool deposit u10000000000)
;; Returns bSTX tokens at 1:1 ratio
```

### Withdraw STX (after cycle ends)
```clarity
(contract-call? .bitstake-pool withdraw u10000000000)
;; Burns bSTX, returns STX + accumulated rewards
```

### Claim BTC Rewards
```clarity
(contract-call? .bitstake-rewards claim-btc-rewards)
;; Sends earned BTC to your registered Bitcoin address
```

### Register Bitcoin Payout Address
```clarity
(contract-call? .bitstake-pool set-btc-address 0x...)
;; Register the BTC address where your rewards will be sent
```

### View Pool Stats
```clarity
(contract-call? .bitstake-pool get-pool-stats)
;; Returns: total-stacked, current-apy, cycle-end-block, reward-pool-btc
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Clarinet](https://github.com/hirosystems/clarinet) >= 2.0
- A Stacks wallet with STX balance
- A Bitcoin address for receiving rewards

### Installation

```bash
git clone https://github.com/thewealthyplace/bitstake
cd bitstake
npm install
```

### Local Development

```bash
# Start local Stacks devnet (includes simulated PoX)
clarinet devnet start

# Run tests
clarinet test

# Start frontend
cd frontend && npm run dev
```

### Deposit & Start Earning

1. Visit the bitstake app and connect your Hiro or Leather wallet
2. Enter the amount of STX you want to stack
3. Choose your lockup period (1–12 cycles)
4. Register your Bitcoin address for rewards
5. Confirm the transaction — bitstake handles everything else

---

## Yield Estimates

| Lockup Cycles | Approx. Duration | Estimated APY* |
|--------------|-----------------|---------------|
| 1 | ~2 weeks | Variable |
| 3 | ~6 weeks | Variable |
| 6 | ~3 months | Variable |
| 12 | ~6 months | Variable |

*APY depends on total STX stacked network-wide and Bitcoin miner fees. Historical data available in the dashboard.

---

## bSTX Liquid Staking Token

When you deposit STX, you receive `bSTX` — a SIP-010 compliant liquid staking token:

- Redeemable 1:1 for STX after your lockup period
- Can be transferred, traded, or used as collateral in DeFi
- Accrues BTC yield that is claimable separately
- Maintains full transparency via on-chain accounting

---

## Fee Structure

| Fee | Rate | Recipient |
|-----|------|-----------|
| Pool management fee | 0.5% of BTC rewards | Protocol treasury |
| Early exit fee | 2% of STX | Redistributed to remaining stakers |
| Deposit/withdrawal | 0% | — |

---

## Security

- Non-custodial: users control their STX via smart contracts only
- Audited Clarity contracts with formal verification planned
- Multi-sig admin keys for protocol parameter updates
- Emergency pause mechanism controlled by governance
- Comprehensive Clarinet test suite

---

## Roadmap

- [x] Core pool stacking contracts
- [x] bSTX liquid token
- [x] BTC reward distribution
- [x] Frontend dashboard with live APY, cycle countdown, and historical charts
- [x] 52-cycle APY chart and cycle calendar with unlock highlights
- [x] Wallet earnings view with CSV export
- [x] Live SSE block feed (no page reload)
- [ ] Multi-pool strategy (conservative / aggressive)
- [ ] DeFi integrations (bSTX as collateral)
- [ ] Mobile app
- [ ] Governance token for protocol decisions

---

## Contributing

```bash
git clone https://github.com/thewealthyplace/bitstake
cd bitstake
npm install
clarinet check
clarinet test
```

---

## License

MIT © [thewealthyplace](https://github.com/thewealthyplace)

---

## Resources

- [Stacks Stacking Documentation](https://docs.stacks.co/stacks-101/stacking)
- [PoX-4 SIP](https://github.com/stacksgov/sips)
- [Clarity Reference](https://docs.stacks.co/clarity)
- [Hiro Wallet](https://wallet.hiro.so/)
- [Stacks Explorer](https://explorer.stacks.co)
