;; bitstake-pool-registry.clar
;; Registry for all stacking pool tiers: Liquid, Balanced, Maxi

(define-constant CONTRACT-OWNER   tx-sender)
(define-constant ERR-NOT-OWNER    (err u100))
(define-constant ERR-POOL-NOT-FOUND (err u101))
(define-constant ERR-POOL-INACTIVE  (err u102))
(define-constant ERR-BELOW-MINIMUM  (err u103))
(define-constant ERR-ALREADY-EXISTS (err u104))

;; Pool registry
(define-map pools
  uint
  {
    name:           (string-ascii 32),
    lockup-cycles:  uint,
    min-deposit:    uint,
    total-stacked:  uint,
    active:         bool,
    token-symbol:   (string-ascii 10)
  }
)

(define-data-var pool-count uint u0)

;; ── Pool Management ───────────────────────────────────────────────────

(define-public (create-pool
  (name          (string-ascii 32))
  (lockup-cycles uint)
  (min-deposit   uint)
  (token-symbol  (string-ascii 10))
)
  (let ((id (+ (var-get pool-count) u1)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (> lockup-cycles u0) ERR-BELOW-MINIMUM)
    (map-set pools id {
      name:           name,
      lockup-cycles:  lockup-cycles,
      min-deposit:    min-deposit,
      total-stacked:  u0,
      active:         true,
      token-symbol:   token-symbol
    })
    (var-set pool-count id)
    (print { event: "pool-created", pool-id: id, name: name, lockup-cycles: lockup-cycles })
    (ok id)
  )
)

(define-public (set-pool-active (pool-id uint) (active bool))
  (let ((pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (map-set pools pool-id (merge pool { active: active }))
    (ok true)
  )
)

;; Internal: update total-stacked when a deposit is made
(define-public (add-to-total (pool-id uint) (amount uint))
  (let ((pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (map-set pools pool-id (merge pool { total-stacked: (+ (get total-stacked pool) amount) }))
    (ok true)
  )
)

(define-public (remove-from-total (pool-id uint) (amount uint))
  (let ((pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (map-set pools pool-id (merge pool { total-stacked: (- (get total-stacked pool) amount) }))
    (ok true)
  )
)

;; ── Read-Only ─────────────────────────────────────────────────────────

(define-read-only (get-pool (pool-id uint))
  (ok (map-get? pools pool-id))
)

(define-read-only (get-pool-count)
  (ok (var-get pool-count))
)

(define-read-only (is-pool-active (pool-id uint))
  (match (map-get? pools pool-id)
    pool (ok (get active pool))
    (ok false)
  )
)

(define-read-only (get-min-deposit (pool-id uint))
  (match (map-get? pools pool-id)
    pool (ok (get min-deposit pool))
    ERR-POOL-NOT-FOUND
  )
)

;; ── Initialise Default Pools ──────────────────────────────────────────

(begin
  ;; Pool 1: Liquid — 1 cycle, 100 STX minimum
  (try! (create-pool "Liquid" u1  u100000000   "lbSTX"))
  ;; Pool 2: Balanced — 3 cycles, 500 STX minimum
  (try! (create-pool "Balanced" u3 u500000000  "bbSTX"))
  ;; Pool 3: Maxi — 12 cycles, 1000 STX minimum
  (try! (create-pool "Maxi" u12 u1000000000   "mbSTX"))
)
