;; bitstake-bstx-oracle-twap.clar
;; Block-time-weighted TWAP accumulator for bSTX/STX
;;
;; Each observation stores (price, block-height).
;; TWAP = sum(price_i * block_weight_i) / sum(block_weight_i)
;; where block_weight_i = block_height_(i+1) - block_height_i
;; The most recent observation uses (current-block - last-block) as its weight.

(define-constant CONTRACT-OWNER      tx-sender)
(define-constant PRECISION           u1000000)   ;; 6 decimals
(define-constant MAX-OBSERVATIONS    u20)
(define-constant ERR-NOT-OWNER       (err u300))
(define-constant ERR-NO-DATA         (err u301))
(define-constant ERR-ZERO-SUPPLY     (err u302))
(define-constant ERR-INVALID-WINDOW  (err u303))

;; ── Storage ───────────────────────────────────────────────────────────

;; Circular price-accumulator stores (cumulative-price, block-height)
;; cumulative-price grows monotonically: each block adds spot-price to it.
;; TWAP over window = (cum_price_now - cum_price_t0) / (block_now - block_t0)

(define-map price-observations
  uint   ;; slot index (0 .. MAX-OBSERVATIONS-1)
  { cumulative-price: uint, block-height: uint }
)

(define-data-var cumulative-price    uint u0)
(define-data-var write-index         uint u0)
(define-data-var total-written       uint u0)
(define-data-var last-update-block   uint u0)
(define-data-var last-spot-price     uint u0)

;; ── Internal ──────────────────────────────────────────────────────────

(define-private (advance-accumulator (spot uint))
  (let (
    (blocks-elapsed (if (> block-height (var-get last-update-block))
                      (- block-height (var-get last-update-block))
                      u1))
    (new-cumulative (+ (var-get cumulative-price) (* spot blocks-elapsed)))
  )
    (var-set cumulative-price new-cumulative)
    new-cumulative
  )
)

(define-private (write-checkpoint (cum-price uint))
  (let ((slot (mod (var-get write-index) MAX-OBSERVATIONS)))
    (map-set price-observations slot
      { cumulative-price: cum-price, block-height: block-height })
    (var-set write-index (+ (var-get write-index) u1))
    (var-set total-written
      (if (< (var-get total-written) MAX-OBSERVATIONS)
        (+ (var-get total-written) u1)
        MAX-OBSERVATIONS
      )
    )
    slot
  )
)

;; Retrieve checkpoint by age: age=0 is the most recent, age=N is N checkpoints ago
(define-private (get-checkpoint-by-age (age uint))
  (let (
    (total  (var-get total-written))
    (widx   (var-get write-index))
  )
    (if (>= age total)
      none
      (let ((slot (mod (+ (- widx u1) (- total age)) MAX-OBSERVATIONS)))
        (map-get? price-observations slot)
      )
    )
  )
)

;; ── Public: push observation ──────────────────────────────────────────

(define-public (push-price (total-stx uint) (total-bstx uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (> total-bstx u0) ERR-ZERO-SUPPLY)

    (let (
      (spot (/ (* total-stx PRECISION) total-bstx))
      (cum  (advance-accumulator spot))
    )
      (write-checkpoint cum)
      (var-set last-update-block block-height)
      (var-set last-spot-price spot)
      (print { event: "twap-push", spot: spot, cumulative: cum, block: block-height })
      (ok spot)
    )
  )
)

;; ── Read-only: TWAP over last N checkpoints ───────────────────────────

;; Returns the time-weighted average price between checkpoint at (age) and now
;; age: how many checkpoints back to start the window
(define-read-only (get-twap-over-window (age uint))
  (let ((checkpoint (get-checkpoint-by-age age)))
    (match checkpoint
      cp (let (
            (block-delta (if (> block-height (get block-height cp))
                           (- block-height (get block-height cp))
                           u1))
            (price-delta (if (>= (var-get cumulative-price) (get cumulative-price cp))
                           (- (var-get cumulative-price) (get cumulative-price cp))
                           u0))
          )
           (if (is-eq block-delta u0)
             (err ERR-INVALID-WINDOW)
             (ok (/ price-delta block-delta))
           )
         )
      (err ERR-NO-DATA)
    )
  )
)

;; Standard TWAP: over the oldest available checkpoint
(define-read-only (get-twap)
  (let ((oldest-age (if (>= (var-get total-written) MAX-OBSERVATIONS)
                      (- MAX-OBSERVATIONS u1)
                      (if (> (var-get total-written) u0)
                        (- (var-get total-written) u1)
                        u0))))
    (get-twap-over-window oldest-age)
  )
)

;; ── Read-only: State ──────────────────────────────────────────────────

(define-read-only (get-last-spot)
  (ok (var-get last-spot-price))
)

(define-read-only (get-cumulative-price)
  (ok (var-get cumulative-price))
)

(define-read-only (get-total-written)
  (ok (var-get total-written))
)

(define-read-only (get-write-index)
  (ok (var-get write-index))
)

(define-read-only (get-checkpoint (slot uint))
  (ok (map-get? price-observations slot))
)
