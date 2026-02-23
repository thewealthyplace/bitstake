;; bitstake-rewards.clar
;; Tracks and distributes stacking rewards per pool tier

(define-constant CONTRACT-OWNER   tx-sender)
(define-constant ERR-NOT-OWNER    (err u100))
(define-constant ERR-NO-REWARDS   (err u105))
(define-constant ERR-ZERO         (err u103))

;; reward-epoch -> pool-id -> total rewards (uSTX)
(define-map epoch-rewards
  { epoch: uint, pool-id: uint }
  { total-reward: uint, total-stacked: uint }
)

;; (depositor, pool-id) -> last claimed epoch
(define-map last-claimed
  { depositor: principal, pool-id: uint }
  uint
)

(define-data-var current-epoch uint u0)

;; ── Epoch Management ──────────────────────────────────────────────────

(define-public (advance-epoch)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set current-epoch (+ (var-get current-epoch) u1))
    (print { event: "epoch-advanced", epoch: (var-get current-epoch) })
    (ok (var-get current-epoch))
  )
)

(define-public (record-epoch-rewards (pool-id uint) (reward-amount uint) (stacked-amount uint))
  (let ((epoch (var-get current-epoch)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (> reward-amount u0) ERR-ZERO)
    (map-set epoch-rewards
      { epoch: epoch, pool-id: pool-id }
      { total-reward: reward-amount, total-stacked: stacked-amount }
    )
    (print { event: "rewards-recorded", epoch: epoch, pool-id: pool-id, reward: reward-amount })
    (ok true)
  )
)

;; ── Reward Calculation ────────────────────────────────────────────────

(define-read-only (get-epoch-reward (epoch uint) (pool-id uint))
  (map-get? epoch-rewards { epoch: epoch, pool-id: pool-id })
)

(define-read-only (get-current-epoch)
  (ok (var-get current-epoch))
)

(define-read-only (get-last-claimed (depositor principal) (pool-id uint))
  (default-to u0 (map-get? last-claimed { depositor: depositor, pool-id: pool-id }))
)

;; Estimate claimable rewards for a depositor in one epoch
(define-read-only (estimate-epoch-reward (depositor principal) (pool-id uint) (epoch uint) (user-stacked uint))
  (match (map-get? epoch-rewards { epoch: epoch, pool-id: pool-id })
    data (if (> (get total-stacked data) u0)
            (ok (/ (* user-stacked (get total-reward data)) (get total-stacked data)))
            (ok u0))
    (ok u0)
  )
)

;; ── Claim ─────────────────────────────────────────────────────────────

(define-public (mark-claimed (depositor principal) (pool-id uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (map-set last-claimed
      { depositor: depositor, pool-id: pool-id }
      (var-get current-epoch)
    )
    (ok true)
  )
)
