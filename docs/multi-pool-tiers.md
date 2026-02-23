# Multi-Pool Strategy Tiers

bitstake provides three distinct stacking pool tiers, each targeting a different risk/lockup/yield profile.

## Pool Tiers

| Pool | Token | Lockup | Min Deposit | Target APY |
|------|-------|--------|-------------|------------|
| Liquid   | lbSTX | 1 cycle (~15 days)  | 100 STX  | ~7%  |
| Balanced | bbSTX | 3 cycles (~45 days) | 500 STX  | ~9%  |
| Maxi     | mbSTX | 12 cycles (~6 months) | 1,000 STX | ~13% |

A Stacks stacking cycle is approximately 2,100 blocks (~2 weeks).

## Contracts

### `bitstake-pool-registry`
Central registry that defines each pool's parameters. Callable by the owner to:
- Create new pool tiers
- Activate / deactivate pools
- Track total stacked per pool

### `bitstake-pool-deposits`
Handles user deposits and withdrawals. Key rules:
- Deposits transfer STX to the contract and record a position with an `unlock-block`
- `unlock-block = current-block + (lockup-cycles × 2100)`
- Withdrawals are blocked until `block-height >= unlock-block` (ERR u106)
- Deposits accumulate (add to existing position if one exists)

### Token Contracts (`bitstake-lbstx`, `bitstake-bbstx`, `bitstake-mbstx`)
SIP-010 fungible tokens representing pool shares. The owner (pool deposits contract) mints tokens 1:1 with deposits and burns on withdrawal.

### `bitstake-rewards`
Epoch-based reward accounting:
- Owner advances epoch each stacking cycle
- Per-epoch reward amounts are recorded per pool
- Pro-rata reward estimation: `(user_stacked / total_stacked) × epoch_reward`

## Error Codes

| Code | Meaning |
|------|---------|
| `u100` | Not owner |
| `u101` | Pool not found |
| `u102` | Pool inactive |
| `u103` | Below minimum deposit |
| `u104` | Already exists |
| `u105` | No position |
| `u106` | Funds still locked |

## Deposit Flow

```
User → deposit-to-pool(pool-id, amount)
  → [check pool active]
  → [check amount >= min-deposit]
  → stx-transfer?(amount, tx-sender, contract)
  → map-set positions { amount, deposited-at, unlock-block }
  → add-to-total(pool-id, amount)
  → (owner calls mint on token contract)
```

## Withdrawal Flow

```
User → withdraw-from-pool(pool-id)
  → [check position exists]
  → [check block-height >= unlock-block]
  → map-delete positions
  → remove-from-total(pool-id, amount)
  → stx-transfer?(amount, contract, user)
  → (owner calls burn on token contract)
```

## Deployment Order

1. `bitstake-pool-registry` — initialises 3 default pools in `begin` block
2. `bitstake-pool-deposits` — references registry via contract-call?
3. Token contracts (`lbstx`, `bbstx`, `mbstx`) — minted/burned by deposits contract
4. `bitstake-rewards` — standalone, updated by owner each epoch
