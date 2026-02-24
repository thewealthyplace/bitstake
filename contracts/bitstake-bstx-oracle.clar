;; bitstake-bstx-oracle.clar
;; bSTX/STX exchange rate oracle
;; Returns total-stx / total-bstx-supply at 6 decimal precision
;; Includes TWAP accumulator and circuit breaker protection

(define-constant CONTRACT-OWNER          tx-sender)
(define-constant PRECISION               u1000000) ;; 6 decimals
(define-constant TWAP-WINDOW             u10)      ;; observations kept
(define-constant CIRCUIT-BREAKER-BPS     u500)     ;; 5% max deviation (500 basis points)
(define-constant MIN-OBSERVATION-GAP     u5)       ;; min blocks between observations

;; ── Error Codes ───────────────────────────────────────────────────────
(define-constant ERR-NOT-OWNER           (err u200))
(define-constant ERR-ZERO-SUPPLY         (err u201))
(define-constant ERR-CIRCUIT-BREAKER     (err u202))
(define-constant ERR-TOO-FREQUENT        (err u203))
(define-constant ERR-NO-OBSERVATIONS     (err u204))
(define-constant ERR-ORACLE-HALTED       (err u205))

;; ── State ─────────────────────────────────────────────────────────────

;; Whether the circuit breaker has tripped and halted the oracle
(define-data-var oracle-halted bool false)

;; Observation index (circular buffer position, 0-9)
(define-data-var observation-index uint u0)

;; Total number of observations ever written (saturates at TWAP-WINDOW)
(define-data-var observation-count uint u0)

;; Block height of the last recorded observation
(define-data-var last-observation-block uint u0)

;; Last computed spot rate (price * PRECISION)
(define-data-var last-spot-rate uint u0)

;; Authorized updater (can be set to an off-chain indexer key)
(define-data-var authorized-updater (optional principal) none)

;; ── TWAP Circular Buffer ──────────────────────────────────────────────
;; Stores (price, block-height) pairs for TWAP computation

(define-map observations uint { price: uint, block-height: uint })

;; ── Internal Helpers ─────────────────────────────────────────────────

(define-private (is-authorized)
  (or
    (is-eq tx-sender CONTRACT-OWNER)
    (match (var-get authorized-updater)
      updater (is-eq tx-sender updater)
      false
    )
  )
)

(define-private (abs-diff (a uint) (b uint))
  (if (>= a b) (- a b) (- b a))
)

;; Returns deviation in basis points between new-price and reference
(define-private (deviation-bps (new-price uint) (reference uint))
  (if (is-eq reference u0)
    u0
    (/ (* (abs-diff new-price reference) u10000) reference)
  )
)

;; ── Spot Rate Calculation ─────────────────────────────────────────────

;; Compute current bSTX exchange rate from on-chain data
;; rate = (total-stx-stacked * PRECISION) / total-bstx-supply
;; Returns rate in micros (6 decimal places; 1.000000 = 1:1 peg)
(define-read-only (compute-spot-rate (total-stx uint) (total-bstx uint))
  (if (is-eq total-bstx u0)
    (err ERR-ZERO-SUPPLY)
    (ok (/ (* total-stx PRECISION) total-bstx))
  )
)

;; ── TWAP Computation ─────────────────────────────────────────────────

;; Retrieve one observation by absolute slot (0-9)
(define-read-only (get-observation (slot uint))
  (map-get? observations slot)
)

;; Compute time-weighted average price across all stored observations
;; Uses simple arithmetic mean of stored prices (block-time-weighted variant
;; requires block gaps; arithmetic mean is the baseline implementation)
(define-read-only (get-twap)
  (let ((count (var-get observation-count)))
    (if (is-eq count u0)
      (err ERR-NO-OBSERVATIONS)
      (let (
        (obs0 (default-to { price: u0, block-height: u0 } (map-get? observations u0)))
        (obs1 (default-to { price: u0, block-height: u0 } (map-get? observations u1)))
        (obs2 (default-to { price: u0, block-height: u0 } (map-get? observations u2)))
        (obs3 (default-to { price: u0, block-height: u0 } (map-get? observations u3)))
        (obs4 (default-to { price: u0, block-height: u0 } (map-get? observations u4)))
        (obs5 (default-to { price: u0, block-height: u0 } (map-get? observations u5)))
        (obs6 (default-to { price: u0, block-height: u0 } (map-get? observations u6)))
        (obs7 (default-to { price: u0, block-height: u0 } (map-get? observations u7)))
        (obs8 (default-to { price: u0, block-height: u0 } (map-get? observations u8)))
        (obs9 (default-to { price: u0, block-height: u0 } (map-get? observations u9)))
        (sum (+ (+ (+ (+ (get price obs0) (get price obs1)) (+ (get price obs2) (get price obs3)))
                   (+ (+ (get price obs4) (get price obs5)) (+ (get price obs6) (get price obs7))))
                (+ (get price obs8) (get price obs9))))
        (effective-count (if (>= count TWAP-WINDOW) TWAP-WINDOW count))
      )
        (ok (/ sum effective-count))
      )
    )
  )
)

;; ── Circuit Breaker ───────────────────────────────────────────────────

;; Check if new-price deviates more than CIRCUIT-BREAKER-BPS from the TWAP
;; If yes, halt the oracle and return an error
(define-private (check-circuit-breaker (new-price uint))
  (match (get-twap)
    twap-price (if (> (deviation-bps new-price twap-price) CIRCUIT-BREAKER-BPS)
                 (begin
                   (var-set oracle-halted true)
                   (print { event: "circuit-breaker-tripped", new-price: new-price, twap: twap-price })
                   (err ERR-CIRCUIT-BREAKER)
                 )
                 (ok true)
               )
    ;; No TWAP yet — skip circuit breaker check on first observations
    _error (ok true)
  )
)

;; ── Record Observation ────────────────────────────────────────────────

;; Write a new price observation into the circular buffer.
;; Enforces minimum block gap and circuit breaker before writing.
(define-public (record-observation (total-stx uint) (total-bstx uint))
  (begin
    (asserts! (is-authorized) ERR-NOT-OWNER)
    (asserts! (not (var-get oracle-halted)) ERR-ORACLE-HALTED)
    (asserts! (>= (- block-height (var-get last-observation-block)) MIN-OBSERVATION-GAP) ERR-TOO-FREQUENT)

    (let ((spot (try! (compute-spot-rate total-stx total-bstx))))
      (try! (check-circuit-breaker spot))

      (let ((slot (mod (var-get observation-index) TWAP-WINDOW)))
        (map-set observations slot { price: spot, block-height: block-height })
        (var-set observation-index (+ (var-get observation-index) u1))
        (var-set observation-count
          (if (< (var-get observation-count) TWAP-WINDOW)
            (+ (var-get observation-count) u1)
            TWAP-WINDOW
          )
        )
        (var-set last-observation-block block-height)
        (var-set last-spot-rate spot)
        (print { event: "observation-recorded", slot: slot, price: spot, block: block-height })
        (ok spot)
      )
    )
  )
)

;; ── Admin ─────────────────────────────────────────────────────────────

;; Reset circuit breaker (owner only, after investigating the anomaly)
(define-public (reset-circuit-breaker)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set oracle-halted false)
    (print { event: "circuit-breaker-reset", by: tx-sender })
    (ok true)
  )
)

;; Set an authorized updater key (e.g. indexer principal)
(define-public (set-authorized-updater (updater (optional principal)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set authorized-updater updater)
    (ok true)
  )
)

;; ── Public Read-Only Interface ────────────────────────────────────────

(define-read-only (get-spot-rate)
  (if (var-get oracle-halted)
    (err ERR-ORACLE-HALTED)
    (ok (var-get last-spot-rate))
  )
)

(define-read-only (get-last-observation-block)
  (ok (var-get last-observation-block))
)

(define-read-only (get-observation-count)
  (ok (var-get observation-count))
)

(define-read-only (is-halted)
  (ok (var-get oracle-halted))
)

(define-read-only (get-authorized-updater)
  (ok (var-get authorized-updater))
)

;; Convenience: return both spot and TWAP in one call
(define-read-only (get-rates)
  (ok {
    spot:    (var-get last-spot-rate),
    halted:  (var-get oracle-halted),
    twap:    (match (get-twap) twap twap u0),
    block:   (var-get last-observation-block)
  })
)
