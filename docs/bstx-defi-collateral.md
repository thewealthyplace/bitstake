# bSTX DeFi Collateral Integration Guide

This document describes how to integrate bSTX (bitstake liquid staking tokens) as collateral in Stacks DeFi protocols. It covers the oracle interface, ALEX lending integration, and Bitflow liquidity pool setup.

---

## Overview

When users deposit STX into bitstake, they receive a liquid staking token:

| Token  | Pool     | Lockup        |
|--------|----------|---------------|
| lbSTX  | Liquid   | 1 cycle (~15 days)   |
| bbSTX  | Balanced | 3 cycles (~45 days)  |
| mbSTX  | Maxi     | 12 cycles (~6 months) |

These tokens represent a claim on pooled STX plus accrued BTC stacking yield. Because the pool earns BTC yield each cycle, bSTX tokens trade at a premium relative to STX that grows over time.

---

## Oracle: `bitstake-bstx-oracle`

### Exchange Rate

```
rate = (total-stx-stacked * 1_000_000) / total-bstx-supply
```

- Result is a `uint` at 6 decimal precision
- `1_000_000` = 1:1 parity
- `1_050_000` = 1.05 STX per bSTX (5% premium)

### Key Read-Only Functions

```clarity
;; Returns spot rate (errors if circuit breaker is open)
(get-spot-rate) → (response uint uint)

;; Returns spot, TWAP, halted flag, and last-block in one call
(get-rates) → (response { spot: uint, halted: bool, twap: uint, block: uint } uint)

;; Compute rate from raw inputs (pure, no state)
(compute-spot-rate (total-stx uint) (total-bstx uint)) → (response uint uint)
```

### Recording Observations

Only the contract owner or an `authorized-updater` can push new observations. Observations must be at least 5 blocks apart.

```clarity
(record-observation (total-stx uint) (total-bstx uint)) → (response uint uint)
```

**Best practice:** call `record-observation` with values from `bitstake-pool-registry.get-aggregate-stacked` (total STX) and the sum of `ft-get-supply` across lbSTX, bbSTX, mbSTX (total bSTX supply).

### TWAP Oracle: `bitstake-bstx-oracle-twap`

For protocols requiring a more manipulation-resistant price:

```clarity
;; Push a new price checkpoint
(push-price (total-stx uint) (total-bstx uint)) → (response uint uint)

;; Get time-weighted average over the full window
(get-twap) → (response uint uint)

;; Get TWAP over the last N checkpoints
(get-twap-over-window (age uint)) → (response uint uint)
```

---

## Circuit Breaker: `bitstake-oracle-circuit-breaker`

The circuit breaker guards against oracle manipulation or erroneous price updates.

### Thresholds (defaults)

| Parameter             | Default | Description                              |
|-----------------------|---------|------------------------------------------|
| `deviation-threshold` | 500 bps | Max single-update price deviation (5%)   |
| `velocity-threshold`  | 1000 bps| Max cumulative move over window (10%)     |
| `velocity-window`     | 100 blocks | Rolling window for velocity check     |

### Integration Pattern

```clarity
;; Before accepting a new oracle price, call:
(contract-call? .bitstake-oracle-circuit-breaker validate-price new-price)
;; → (ok new-price) if safe
;; → (err u402) if deviation exceeded (breaker trips)
;; → (err u403) if velocity exceeded (breaker trips)
;; → (err u401) if breaker is already open
```

---

## ALEX Lending Integration

### Proposed Parameters

| Parameter               | Value   |
|-------------------------|---------|
| Collateral Asset        | lbSTX / bbSTX / mbSTX |
| Loan-to-Value (LTV)     | 75%     |
| Liquidation Threshold   | 80%     |
| Liquidation Bonus       | 5%      |
| Price Oracle            | `bitstake-bstx-oracle` |

### Governance Proposal Contract: `bitstake-alex-governance`

The proposal contract records the collateral listing request on-chain and allows community signalling votes before formal ALEX governance submission.

```clarity
;; Owner submits proposal lifecycle
(transition-status proposal-id STATUS-SUBMITTED)
(transition-status proposal-id STATUS-ACTIVE)

;; Community signal voting
(cast-vote proposal-id true)   ;; support
(cast-vote proposal-id false)  ;; oppose
```

### Submitting to ALEX Governance (Off-Chain Steps)

1. Deploy `bitstake-bstx-oracle` to mainnet and verify exchange rate accuracy over at least 2 stacking cycles.
2. Transition the on-chain proposal to `SUBMITTED` status.
3. Post the proposal on ALEX governance forum with:
   - Token contract address
   - Oracle contract address and exchange-rate methodology
   - LTV / liquidation parameters
   - Risk analysis (IL, depeg scenarios, liquidation cascade)
4. Link the forum post to the on-chain proposal.
5. After community approval, coordinate with the ALEX team to allowlist bSTX as collateral.

---

## Bitflow Liquidity Pool: `bitstake-bitflow-pool`

### Pool Parameters

| Parameter        | Value                   |
|------------------|-------------------------|
| Pair             | bSTX / STX              |
| Fee Tier         | 0.05% (5 bps)           |
| Initial Price    | 1.01 STX per bSTX       |
| Tick Lower       | 0.95 STX per bSTX       |
| Tick Upper       | 1.05 STX per bSTX       |

The narrow ±5% band captures nearly all bSTX/STX trading activity while concentrating capital efficiently.

### Adding Liquidity

```clarity
(contract-call? .bitstake-bitflow-pool add-liquidity
  bstx-amount   ;; uint — bSTX to deposit
  stx-amount    ;; uint — STX to deposit
  min-bstx      ;; uint — slippage floor for bSTX
  min-stx       ;; uint — slippage floor for STX
)
;; → (ok position-id)
```

### Swapping STX → bSTX

```clarity
(contract-call? .bitstake-bitflow-pool swap-stx-for-bstx
  stx-in        ;; uint — STX amount in
  min-bstx-out  ;; uint — minimum bSTX to receive
)
;; → (ok bstx-received)
```

### Quote

```clarity
(contract-call? .bitstake-bitflow-pool quote-stx-for-bstx stx-in)
;; → (ok { bstx-out: uint, fee: uint, price: uint })
```

---

## Deployment Order

```
1. bitstake-pool-registry       (already deployed)
2. bitstake-pool-deposits       (already deployed)
3. bitstake-lbstx               (already deployed)
4. bitstake-bbstx               (already deployed)
5. bitstake-mbstx               (already deployed)
6. bitstake-rewards             (already deployed)
7. bitstake-oracle-circuit-breaker   ← new
8. bitstake-bstx-oracle              ← new
9. bitstake-bstx-oracle-twap         ← new
10. bitstake-alex-governance         ← new
11. bitstake-bitflow-pool            ← new
```

After deployment, call `set-authorized-updater` on both oracle contracts with the indexer's principal to allow automated price updates.

---

## Security Considerations

- **TWAP manipulation**: The TWAP window covers the last 20 checkpoints. Significant liquidity depth in the Bitflow pool is needed before TWAP is reliable for high-value lending.
- **Depeg risk**: If `total-stx < total-bstx-supply` (impossible in normal operation — can only happen via a bug), the oracle returns < 1:1. The circuit breaker velocity check guards against sudden depeg.
- **Liquidation cascade**: At 75% LTV, a 6.25% drop in the bSTX/STX rate triggers liquidations. Given the expected narrow price band (±5%), this risk is minimal but should be monitored.
- **Oracle freshness**: Protocols consuming `get-spot-rate` should check `get-last-observation-block` and reject stale prices (e.g., no update within 50 blocks).
