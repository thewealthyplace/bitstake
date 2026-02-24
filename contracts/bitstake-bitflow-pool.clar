;; bitstake-bitflow-pool.clar
;; bSTX/STX concentrated liquidity pool setup for Bitflow
;;
;; Records the pool configuration, liquidity position registry, and
;; fee accounting for the bSTX/STX pair. The narrow price band (0.95–1.05)
;; captures near-par trading with minimal impermanent loss.

(define-constant CONTRACT-OWNER         tx-sender)
(define-constant PRECISION              u1000000)

;; Fee tiers in basis points
(define-constant FEE-TIER-LOW           u5)    ;; 0.05% — tight stable pairs
(define-constant FEE-TIER-MED           u30)   ;; 0.30% — standard
(define-constant FEE-TIER-HIGH          u100)  ;; 1.00% — volatile

;; Default pool configuration for bSTX/STX
;; Price is expressed as token-A per token-B * PRECISION
;; Since bSTX accrues BTC yield, it trades at a slight premium to STX
(define-constant POOL-INITIAL-PRICE     u1010000)  ;; 1.01 STX per bSTX at launch
(define-constant POOL-TICK-LOWER        u950000)   ;; 0.95 (lower bound)
(define-constant POOL-TICK-UPPER        u1050000)  ;; 1.05 (upper bound)
(define-constant POOL-FEE-TIER          FEE-TIER-LOW)

;; Error codes
(define-constant ERR-NOT-OWNER          (err u600))
(define-constant ERR-ZERO-AMOUNT        (err u601))
(define-constant ERR-BELOW-TICK         (err u602))
(define-constant ERR-ABOVE-TICK         (err u603))
(define-constant ERR-POOL-PAUSED        (err u604))
(define-constant ERR-SLIPPAGE           (err u605))
(define-constant ERR-NO-POSITION        (err u606))
(define-constant ERR-INVALID-TICK       (err u607))

;; ── Pool State ────────────────────────────────────────────────────────

(define-data-var pool-active           bool  true)
(define-data-var current-price         uint  POOL-INITIAL-PRICE)
(define-data-var tick-lower            uint  POOL-TICK-LOWER)
(define-data-var tick-upper            uint  POOL-TICK-UPPER)
(define-data-var fee-tier              uint  POOL-FEE-TIER)
(define-data-var total-liquidity       uint  u0)
(define-data-var total-fees-stx        uint  u0)
(define-data-var total-fees-bstx       uint  u0)
(define-data-var position-count        uint  u0)

;; bSTX and STX reserves
(define-data-var reserve-bstx          uint  u0)
(define-data-var reserve-stx           uint  u0)

;; ── Liquidity Positions ───────────────────────────────────────────────

(define-map positions
  uint   ;; position-id
  {
    provider:      principal,
    bstx-amount:   uint,
    stx-amount:    uint,
    liquidity:     uint,
    tick-lower:    uint,
    tick-upper:    uint,
    fees-bstx:     uint,
    fees-stx:      uint,
    created-block: uint
  }
)

(define-map provider-positions principal (list 20 uint))

;; ── Internal ──────────────────────────────────────────────────────────

(define-private (compute-liquidity (bstx uint) (stx uint))
  ;; L = sqrt(bstx * stx) — simplified integer approximation
  ;; We use (bstx + stx) / 2 as a proxy to avoid square root in Clarity
  (/ (* (+ bstx stx) PRECISION) u2000000)
)

(define-private (compute-fee (amount uint) (tier uint))
  (/ (* amount tier) u10000)
)

(define-private (price-in-range (price uint))
  (and (>= price (var-get tick-lower)) (<= price (var-get tick-upper)))
)

;; ── Add Liquidity ─────────────────────────────────────────────────────

(define-public (add-liquidity
  (bstx-amount uint)
  (stx-amount  uint)
  (min-bstx    uint)
  (min-stx     uint)
)
  (begin
    (asserts! (var-get pool-active) ERR-POOL-PAUSED)
    (asserts! (> bstx-amount u0) ERR-ZERO-AMOUNT)
    (asserts! (> stx-amount u0) ERR-ZERO-AMOUNT)
    (asserts! (>= bstx-amount min-bstx) ERR-SLIPPAGE)
    (asserts! (>= stx-amount min-stx) ERR-SLIPPAGE)

    (let (
      (liq  (compute-liquidity bstx-amount stx-amount))
      (id   (+ (var-get position-count) u1))
    )
      ;; Transfer assets to pool contract
      (try! (stx-transfer? stx-amount tx-sender (as-contract tx-sender)))

      ;; Record position
      (map-set positions id {
        provider:      tx-sender,
        bstx-amount:   bstx-amount,
        stx-amount:    stx-amount,
        liquidity:     liq,
        tick-lower:    (var-get tick-lower),
        tick-upper:    (var-get tick-upper),
        fees-bstx:     u0,
        fees-stx:      u0,
        created-block: block-height
      })

      ;; Update reserves and totals
      (var-set reserve-bstx (+ (var-get reserve-bstx) bstx-amount))
      (var-set reserve-stx  (+ (var-get reserve-stx)  stx-amount))
      (var-set total-liquidity (+ (var-get total-liquidity) liq))
      (var-set position-count id)

      (print { event: "liquidity-added", id: id, provider: tx-sender,
               bstx: bstx-amount, stx: stx-amount, liquidity: liq })
      (ok id)
    )
  )
)

;; ── Remove Liquidity ──────────────────────────────────────────────────

(define-public (remove-liquidity (position-id uint))
  (let (
    (pos (unwrap! (map-get? positions position-id) ERR-NO-POSITION))
  )
    (asserts! (is-eq tx-sender (get provider pos)) ERR-NOT-OWNER)
    (asserts! (var-get pool-active) ERR-POOL-PAUSED)

    (let (
      (bstx-out (+ (get bstx-amount pos) (get fees-bstx pos)))
      (stx-out  (+ (get stx-amount pos)  (get fees-stx pos)))
      (liq      (get liquidity pos))
    )
      ;; Return STX
      (try! (as-contract (stx-transfer? stx-out tx-sender tx-sender)))

      ;; Update state
      (map-delete positions position-id)
      (var-set reserve-bstx
        (if (>= (var-get reserve-bstx) (get bstx-amount pos))
          (- (var-get reserve-bstx) (get bstx-amount pos)) u0))
      (var-set reserve-stx
        (if (>= (var-get reserve-stx) (get stx-amount pos))
          (- (var-get reserve-stx) (get stx-amount pos)) u0))
      (var-set total-liquidity
        (if (>= (var-get total-liquidity) liq)
          (- (var-get total-liquidity) liq) u0))

      (print { event: "liquidity-removed", id: position-id, provider: tx-sender,
               bstx-out: bstx-out, stx-out: stx-out })
      (ok { bstx-out: bstx-out, stx-out: stx-out })
    )
  )
)

;; ── Swap (simplified) ─────────────────────────────────────────────────

;; Swap STX for bSTX (buy bSTX)
(define-public (swap-stx-for-bstx (stx-in uint) (min-bstx-out uint))
  (begin
    (asserts! (var-get pool-active) ERR-POOL-PAUSED)
    (asserts! (> stx-in u0) ERR-ZERO-AMOUNT)

    (let (
      (fee     (compute-fee stx-in (var-get fee-tier)))
      (net-in  (- stx-in fee))
      (price   (var-get current-price))
      (bstx-out (/ (* net-in PRECISION) price))
    )
      (asserts! (>= bstx-out min-bstx-out) ERR-SLIPPAGE)
      (asserts! (<= bstx-out (var-get reserve-bstx)) ERR-ZERO-AMOUNT)

      (try! (stx-transfer? stx-in tx-sender (as-contract tx-sender)))

      (var-set reserve-stx  (+ (var-get reserve-stx)  net-in))
      (var-set reserve-bstx (- (var-get reserve-bstx) bstx-out))
      (var-set total-fees-stx (+ (var-get total-fees-stx) fee))

      (print { event: "swap", direction: "stx-to-bstx", in: stx-in, out: bstx-out, fee: fee })
      (ok bstx-out)
    )
  )
)

;; ── Admin ─────────────────────────────────────────────────────────────

(define-public (update-price (new-price uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (price-in-range new-price) ERR-INVALID-TICK)
    (var-set current-price new-price)
    (print { event: "price-updated", price: new-price })
    (ok true)
  )
)

(define-public (set-pool-active (active bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set pool-active active)
    (ok true)
  )
)

;; ── Read-Only ─────────────────────────────────────────────────────────

(define-read-only (get-pool-stats)
  (ok {
    active:           (var-get pool-active),
    current-price:    (var-get current-price),
    tick-lower:       (var-get tick-lower),
    tick-upper:       (var-get tick-upper),
    fee-tier-bps:     (var-get fee-tier),
    total-liquidity:  (var-get total-liquidity),
    reserve-bstx:     (var-get reserve-bstx),
    reserve-stx:      (var-get reserve-stx),
    total-fees-bstx:  (var-get total-fees-bstx),
    total-fees-stx:   (var-get total-fees-stx),
    position-count:   (var-get position-count)
  })
)

(define-read-only (get-position (id uint))
  (ok (map-get? positions id))
)

(define-read-only (quote-stx-for-bstx (stx-in uint))
  (let (
    (fee    (compute-fee stx-in (var-get fee-tier)))
    (net-in (- stx-in fee))
    (out    (/ (* net-in PRECISION) (var-get current-price)))
  )
    (ok { bstx-out: out, fee: fee, price: (var-get current-price) })
  )
)
