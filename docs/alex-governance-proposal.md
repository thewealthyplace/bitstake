# [ALEX Governance Proposal] List bSTX as Lending Collateral

**Status:** DRAFT
**Author:** bitstake core team
**Forum:** ALEX Finance Governance

---

## Summary

We propose to list bitstake's bSTX liquid staking tokens (lbSTX, bbSTX, mbSTX) as accepted collateral assets on ALEX lending. This enables users to borrow against their stacked STX positions without sacrificing BTC yield, unlocking DeFi composability on Stacks.

---

## Motivation

When users deposit STX into bitstake, their capital is locked for 1–12 stacking cycles. Unlike Ethereum (where stETH is accepted on Aave, rETH on Compound), Stacks has no primitive allowing stacked STX to be reused in DeFi. This creates an opportunity cost that discourages large stacking participation.

Listing bSTX on ALEX lending would:

1. Allow stacking participants to borrow STX or sBTC against bSTX positions
2. Increase overall Stacks DeFi TVL
3. Create a productive use case for bSTX beyond yield accrual
4. Demonstrate a liquid staking + DeFi composability pattern for the Stacks ecosystem

---

## Proposed Parameters

| Parameter               | Value                   | Rationale                                     |
|-------------------------|-------------------------|-----------------------------------------------|
| Collateral Asset        | lbSTX, bbSTX, mbSTX     | All three pool tokens share the oracle         |
| Price Oracle            | `bitstake-bstx-oracle`  | On-chain, manipulation-resistant, TWAP-backed  |
| Loan-to-Value (LTV)     | 75%                     | Conservative — accounts for ±5% price band     |
| Liquidation Threshold   | 80%                     | 5% buffer above LTV                            |
| Liquidation Bonus       | 5%                      | Incentivises liquidators                       |
| Borrow Cap              | 500,000 STX equivalent  | Phased rollout cap                             |
| Supply Cap              | 2,000,000 STX equivalent| Limits concentration risk                     |

---

## Oracle Design

The `bitstake-bstx-oracle` contract computes the bSTX exchange rate as:

```
rate = (total-stx-stacked × 1,000,000) / total-bstx-supply
```

**Manipulation resistance:**

- **TWAP accumulator** (`bitstake-bstx-oracle-twap`): block-time-weighted average over 20 checkpoints. Large single-block price moves are smoothed.
- **Circuit breaker** (`bitstake-oracle-circuit-breaker`): halts price updates if a single observation deviates > 5% from the previous accepted price, or if cumulative movement over a 100-block window exceeds 10%.
- **Minimum observation gap**: 5 blocks between oracle updates prevents rapid refresh attacks.
- **Authorized updater**: Only the owner or a designated indexer principal can push observations.

---

## Risk Analysis

### Depeg Risk
bSTX can only trade at a discount to STX if the bitstake pool loses funds (smart contract exploit). In normal operation the rate only increases (as BTC yield accrues). The circuit breaker guards against sudden depeg scenarios.

### Liquidation Cascade
At 75% LTV, borrowers are liquidated when bSTX falls to 93.75% of its borrow value in STX terms. Given bSTX normally trades within ±5% of par, this event requires an extraordinary market dislocation. The phased borrow cap limits systemic risk during initial rollout.

### Oracle Freshness
ALEX contracts should verify that `get-last-observation-block` is within 50 blocks of the current block before accepting the oracle price. A staleness guard prevents using a frozen price during network events.

### Smart Contract Risk
All bitstake contracts use Clarity 2 with no `unwrap-panic`. Error codes are explicit. The oracle contracts are standalone with no upgrade mechanism — a new deployment would be needed for any changes.

---

## Implementation Checklist

- [x] bSTX price oracle contract deployed on testnet
- [x] TWAP accumulator deployed and tested
- [x] Circuit breaker deployed and tested
- [x] ALEX governance on-chain proposal seeded (`bitstake-alex-governance`, proposal id 1)
- [x] Integration guide published (`docs/bstx-defi-collateral.md`)
- [ ] Oracle monitored over 2 mainnet stacking cycles before listing
- [ ] ALEX team technical review of oracle methodology
- [ ] Community vote on ALEX governance forum
- [ ] Mainnet deployment of lending collateral configuration

---

## On-Chain Proposal

The on-chain governance record is available at:

```
Contract: bitstake-alex-governance
Proposal ID: 1
Status: DRAFT → SUBMITTED (upon forum publication)
```

Community signalling votes can be cast on-chain via:
```clarity
(contract-call? .bitstake-alex-governance cast-vote u1 true)  ;; support
(contract-call? .bitstake-alex-governance cast-vote u1 false) ;; oppose
```

---

## References

- bitstake codebase: https://github.com/thewealthyplace/bitstake
- ALEX Finance docs: https://docs.alexlab.co
- Bitflow docs: https://docs.bitflow.finance
- Stacks SIP-010 standard: https://github.com/stacksgov/sips
