;; bitstake-pool-deposits.clar
;; Handles deposits and withdrawals for each pool tier

(define-constant CONTRACT-OWNER    tx-sender)
(define-constant ERR-NOT-OWNER     (err u100))
(define-constant ERR-POOL-INACTIVE (err u102))
(define-constant ERR-BELOW-MIN     (err u103))
(define-constant ERR-NO-POSITION   (err u105))
(define-constant ERR-LOCKED        (err u106))

;; (pool-id, depositor) -> position
(define-map positions
  { pool-id: uint, depositor: principal }
  {
    amount:        uint,
    deposited-at:  uint,
    unlock-block:  uint
  }
)

;; Track total deposited per user across all pools
(define-map user-total-stacked principal uint)

;; ── Deposit ───────────────────────────────────────────────────────────

(define-public (deposit-to-pool (pool-id uint) (amount uint))
  (let (
    (pool    (unwrap! (contract-call? .bitstake-pool-registry get-pool pool-id) (err u101)))
    (p-data  (unwrap! pool (err u101)))
    (min-dep (get min-deposit p-data))
    (cycles  (get lockup-cycles p-data))
  )
    (asserts! (get active p-data)       ERR-POOL-INACTIVE)
    (asserts! (>= amount min-dep)       ERR-BELOW-MIN)

    ;; Transfer STX to contract
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))

    ;; Record position (add to existing if any)
    (let (
      (key     { pool-id: pool-id, depositor: tx-sender })
      (existing (map-get? positions key))
      (unlock  (+ block-height (* cycles u2100))) ;; ~2100 blocks per cycle
    )
      (match existing
        pos (map-set positions key {
          amount:       (+ (get amount pos) amount),
          deposited-at: block-height,
          unlock-block: unlock
        })
        (map-set positions key {
          amount:       amount,
          deposited-at: block-height,
          unlock-block: unlock
        })
      )
    )

    ;; Update registry total
    (try! (contract-call? .bitstake-pool-registry add-to-total pool-id amount))

    (print { event: "deposit", pool-id: pool-id, depositor: tx-sender, amount: amount })
    (ok true)
  )
)

;; ── Withdraw ──────────────────────────────────────────────────────────

(define-public (withdraw-from-pool (pool-id uint))
  (let (
    (key      { pool-id: pool-id, depositor: tx-sender })
    (position (unwrap! (map-get? positions key) ERR-NO-POSITION))
    (amount   (get amount position))
  )
    (asserts! (>= block-height (get unlock-block position)) ERR-LOCKED)

    (map-delete positions key)
    (try! (contract-call? .bitstake-pool-registry remove-from-total pool-id amount))
    (try! (as-contract (stx-transfer? amount tx-sender tx-sender)))

    (print { event: "withdrawal", pool-id: pool-id, depositor: tx-sender, amount: amount })
    (ok amount)
  )
)

;; ── Read-Only ─────────────────────────────────────────────────────────

(define-read-only (get-position (pool-id uint) (depositor principal))
  (ok (map-get? positions { pool-id: pool-id, depositor: depositor }))
)

(define-read-only (is-locked (pool-id uint) (depositor principal))
  (match (map-get? positions { pool-id: pool-id, depositor: depositor })
    pos (ok (< block-height (get unlock-block pos)))
    (ok false)
  )
)

(define-read-only (blocks-until-unlock (pool-id uint) (depositor principal))
  (match (map-get? positions { pool-id: pool-id, depositor: depositor })
    pos (if (>= block-height (get unlock-block pos))
          (ok u0)
          (ok (- (get unlock-block pos) block-height)))
    (ok u0)
  )
)
