;; bitstake-oracle-circuit-breaker.clar
;; Standalone circuit breaker for bSTX oracle price feeds
;;
;; Enforces:
;;   1. Maximum single-update deviation threshold (basis points)
;;   2. Maximum rate of change over a rolling block window
;;   3. Admin pause / resume with reason logging

(define-constant CONTRACT-OWNER           tx-sender)
(define-constant PRECISION                u1000000)
(define-constant DEFAULT-DEVIATION-BPS    u500)   ;; 5 % per observation
(define-constant DEFAULT-VELOCITY-BPS     u1000)  ;; 10% over velocity window
(define-constant DEFAULT-VELOCITY-WINDOW  u100)   ;; blocks for velocity check

;; ── Error Codes ───────────────────────────────────────────────────────
(define-constant ERR-NOT-OWNER            (err u400))
(define-constant ERR-BREAKER-OPEN         (err u401))
(define-constant ERR-DEVIATION-EXCEEDED   (err u402))
(define-constant ERR-VELOCITY-EXCEEDED    (err u403))
(define-constant ERR-INVALID-PARAMS       (err u404))

;; ── State ─────────────────────────────────────────────────────────────

(define-data-var breaker-open         bool  false)
(define-data-var pause-reason         (string-ascii 128) "")
(define-data-var deviation-threshold  uint  DEFAULT-DEVIATION-BPS)
(define-data-var velocity-threshold   uint  DEFAULT-VELOCITY-BPS)
(define-data-var velocity-window      uint  DEFAULT-VELOCITY-WINDOW)

;; Reference price snapshot: (price, block-height)
(define-data-var reference-price      uint  u0)
(define-data-var reference-block      uint  u0)

;; All-time last accepted price
(define-data-var last-price           uint  u0)
(define-data-var last-price-block     uint  u0)

;; Count of breaker trips since last reset
(define-data-var trip-count           uint  u0)

;; ── Pure Helpers ──────────────────────────────────────────────────────

(define-private (abs-diff (a uint) (b uint))
  (if (>= a b) (- a b) (- b a))
)

(define-private (bps (numerator uint) (denominator uint))
  (if (is-eq denominator u0)
    u0
    (/ (* numerator u10000) denominator)
  )
)

;; ── Deviation Check ───────────────────────────────────────────────────

(define-private (check-deviation (new-price uint))
  (let ((ref (var-get last-price)))
    (if (is-eq ref u0)
      (ok true) ;; no reference yet, allow
      (let ((dev (bps (abs-diff new-price ref) ref)))
        (if (> dev (var-get deviation-threshold))
          (begin
            (print { event: "deviation-check-failed", new: new-price, ref: ref, dev-bps: dev })
            (err ERR-DEVIATION-EXCEEDED)
          )
          (ok true)
        )
      )
    )
  )
)

;; ── Velocity Check ────────────────────────────────────────────────────

;; Velocity = price change rate over the velocity window
;; If (block-height - reference-block) >= velocity-window, take a fresh snapshot
(define-private (check-velocity (new-price uint))
  (let (
    (ref-price (var-get reference-price))
    (ref-block (var-get reference-block))
    (window    (var-get velocity-window))
  )
    (if (or (is-eq ref-price u0) (>= (- block-height ref-block) window))
      ;; Start a new velocity window
      (begin
        (var-set reference-price new-price)
        (var-set reference-block block-height)
        (ok true)
      )
      ;; Within existing window: check cumulative move
      (let ((vel (bps (abs-diff new-price ref-price) ref-price)))
        (if (> vel (var-get velocity-threshold))
          (begin
            (print { event: "velocity-check-failed", new: new-price, ref: ref-price, vel-bps: vel })
            (err ERR-VELOCITY-EXCEEDED)
          )
          (ok true)
        )
      )
    )
  )
)

;; ── Primary Validate Entry Point ──────────────────────────────────────

;; Called by oracle before accepting a new price update.
;; Returns (ok new-price) on success, trips breaker and returns err on failure.
(define-public (validate-price (new-price uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (not (var-get breaker-open)) ERR-BREAKER-OPEN)

    (match (check-deviation new-price)
      _ok (match (check-velocity new-price)
            _ok2 (begin
                   (var-set last-price new-price)
                   (var-set last-price-block block-height)
                   (ok new-price)
                 )
            err2 (begin
                   (var-set breaker-open true)
                   (var-set trip-count (+ (var-get trip-count) u1))
                   (var-set pause-reason "velocity threshold exceeded")
                   (print { event: "breaker-tripped", reason: "velocity", new-price: new-price })
                   (err err2)
                 )
          )
      err1 (begin
             (var-set breaker-open true)
             (var-set trip-count (+ (var-get trip-count) u1))
             (var-set pause-reason "deviation threshold exceeded")
             (print { event: "breaker-tripped", reason: "deviation", new-price: new-price })
             (err err1)
           )
    )
  )
)

;; ── Admin ─────────────────────────────────────────────────────────────

(define-public (trip-breaker (reason (string-ascii 128)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set breaker-open true)
    (var-set pause-reason reason)
    (var-set trip-count (+ (var-get trip-count) u1))
    (print { event: "manual-trip", reason: reason })
    (ok true)
  )
)

(define-public (reset-breaker)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set breaker-open false)
    (var-set pause-reason "")
    (var-set reference-price u0)
    (var-set reference-block u0)
    (print { event: "breaker-reset", by: tx-sender })
    (ok true)
  )
)

(define-public (set-deviation-threshold (bps-value uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (and (> bps-value u0) (<= bps-value u5000)) ERR-INVALID-PARAMS)
    (var-set deviation-threshold bps-value)
    (ok true)
  )
)

(define-public (set-velocity-threshold (bps-value uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (and (> bps-value u0) (<= bps-value u10000)) ERR-INVALID-PARAMS)
    (var-set velocity-threshold bps-value)
    (ok true)
  )
)

(define-public (set-velocity-window (blocks uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (and (> blocks u0) (<= blocks u2100)) ERR-INVALID-PARAMS)
    (var-set velocity-window blocks)
    (ok true)
  )
)

;; ── Read-Only ─────────────────────────────────────────────────────────

(define-read-only (get-status)
  (ok {
    open:               (var-get breaker-open),
    reason:             (var-get pause-reason),
    trip-count:         (var-get trip-count),
    last-price:         (var-get last-price),
    last-price-block:   (var-get last-price-block),
    deviation-bps:      (var-get deviation-threshold),
    velocity-bps:       (var-get velocity-threshold),
    velocity-window:    (var-get velocity-window)
  })
)

(define-read-only (is-open)
  (ok (var-get breaker-open))
)

(define-read-only (get-last-price)
  (ok (var-get last-price))
)
