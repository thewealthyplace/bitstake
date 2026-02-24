;; bitstake-alex-governance.clar
;; Governance proposal for bSTX collateral listing on ALEX lending protocol
;;
;; Records the on-chain intent to submit bSTX as a lending collateral asset.
;; Proposal parameters: 75% LTV, 80% liquidation threshold, 5% liquidation bonus.
;; Status lifecycle: DRAFT → SUBMITTED → ACTIVE → PASSED | REJECTED

(define-constant CONTRACT-OWNER              tx-sender)

;; Status codes
(define-constant STATUS-DRAFT                u0)
(define-constant STATUS-SUBMITTED            u1)
(define-constant STATUS-ACTIVE               u2)
(define-constant STATUS-PASSED               u3)
(define-constant STATUS-REJECTED             u4)

;; Error codes
(define-constant ERR-NOT-OWNER               (err u500))
(define-constant ERR-INVALID-TRANSITION      (err u501))
(define-constant ERR-PROPOSAL-NOT-FOUND      (err u502))
(define-constant ERR-DUPLICATE               (err u503))
(define-constant ERR-INVALID-PARAMS          (err u504))

;; LTV / liquidation constants (basis points, 10000 = 100%)
(define-constant PROPOSED-LTV-BPS            u7500)  ;; 75%
(define-constant LIQUIDATION-THRESHOLD-BPS   u8000)  ;; 80%
(define-constant LIQUIDATION-BONUS-BPS       u500)   ;; 5%
(define-constant PRECISION                   u10000)

;; ── Storage ───────────────────────────────────────────────────────────

(define-data-var proposal-count uint u0)

(define-map proposals
  uint
  {
    title:                  (string-ascii 128),
    description:            (string-ascii 512),
    collateral-asset:       principal,
    oracle-contract:        principal,
    ltv-bps:                uint,
    liquidation-threshold:  uint,
    liquidation-bonus:      uint,
    status:                 uint,
    submitted-at:           uint,
    votes-for:              uint,
    votes-against:          uint
  }
)

;; Track which addresses have voted on each proposal
(define-map votes { proposal-id: uint, voter: principal } bool)

;; ── Internal ──────────────────────────────────────────────────────────

(define-private (get-proposal-or-fail (id uint))
  (match (map-get? proposals id)
    p (ok p)
    (err ERR-PROPOSAL-NOT-FOUND)
  )
)

(define-private (status-allows-transition (current uint) (next uint))
  (or
    (and (is-eq current STATUS-DRAFT)      (is-eq next STATUS-SUBMITTED))
    (and (is-eq current STATUS-SUBMITTED)  (is-eq next STATUS-ACTIVE))
    (and (is-eq current STATUS-ACTIVE)     (is-eq next STATUS-PASSED))
    (and (is-eq current STATUS-ACTIVE)     (is-eq next STATUS-REJECTED))
  )
)

;; ── Create Proposal ───────────────────────────────────────────────────

(define-public (create-proposal
  (title         (string-ascii 128))
  (description   (string-ascii 512))
  (collateral    principal)
  (oracle        principal)
  (ltv-bps       uint)
  (liq-threshold uint)
  (liq-bonus     uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (and (> ltv-bps u0) (< ltv-bps PRECISION)) ERR-INVALID-PARAMS)
    (asserts! (> liq-threshold ltv-bps) ERR-INVALID-PARAMS)
    (asserts! (< liq-threshold PRECISION) ERR-INVALID-PARAMS)
    (asserts! (and (> liq-bonus u0) (< liq-bonus u2000)) ERR-INVALID-PARAMS)

    (let ((id (+ (var-get proposal-count) u1)))
      (map-set proposals id {
        title:                  title,
        description:            description,
        collateral-asset:       collateral,
        oracle-contract:        oracle,
        ltv-bps:                ltv-bps,
        liquidation-threshold:  liq-threshold,
        liquidation-bonus:      liq-bonus,
        status:                 STATUS-DRAFT,
        submitted-at:           block-height,
        votes-for:              u0,
        votes-against:          u0
      })
      (var-set proposal-count id)
      (print { event: "proposal-created", id: id, title: title, ltv: ltv-bps })
      (ok id)
    )
  )
)

;; ── Status Transitions ────────────────────────────────────────────────

(define-public (transition-status (proposal-id uint) (new-status uint))
  (let ((proposal (try! (get-proposal-or-fail proposal-id))))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (status-allows-transition (get status proposal) new-status) ERR-INVALID-TRANSITION)
    (map-set proposals proposal-id (merge proposal {
      status: new-status,
      submitted-at: (if (is-eq new-status STATUS-SUBMITTED) block-height (get submitted-at proposal))
    }))
    (print { event: "status-transition", id: proposal-id, from: (get status proposal), to: new-status })
    (ok true)
  )
)

;; ── Voting ────────────────────────────────────────────────────────────

;; Signalling vote (not binding — records community sentiment on-chain)
(define-public (cast-vote (proposal-id uint) (support bool))
  (let (
    (proposal (try! (get-proposal-or-fail proposal-id)))
    (key { proposal-id: proposal-id, voter: tx-sender })
  )
    (asserts! (is-eq (get status proposal) STATUS-ACTIVE) ERR-INVALID-TRANSITION)
    (asserts! (is-none (map-get? votes key)) ERR-DUPLICATE)
    (map-set votes key support)
    (map-set proposals proposal-id
      (merge proposal {
        votes-for:     (if support (+ (get votes-for proposal) u1)     (get votes-for proposal)),
        votes-against: (if support (get votes-against proposal) (+ (get votes-against proposal) u1))
      })
    )
    (print { event: "vote-cast", id: proposal-id, voter: tx-sender, support: support })
    (ok true)
  )
)

;; ── Read-Only ─────────────────────────────────────────────────────────

(define-read-only (get-proposal (id uint))
  (ok (map-get? proposals id))
)

(define-read-only (get-proposal-count)
  (ok (var-get proposal-count))
)

(define-read-only (get-vote (proposal-id uint) (voter principal))
  (ok (map-get? votes { proposal-id: proposal-id, voter: voter }))
)

(define-read-only (get-default-params)
  (ok {
    ltv-bps:               PROPOSED-LTV-BPS,
    liquidation-threshold: LIQUIDATION-THRESHOLD-BPS,
    liquidation-bonus:     LIQUIDATION-BONUS-BPS
  })
)

;; ── Initialise Default Proposal ───────────────────────────────────────

(begin
  (try! (create-proposal
    "List bSTX as Collateral on ALEX Lending"
    "Enable bSTX (Liquid bitstake STX) as accepted collateral on ALEX lending with 75% LTV, 80% liquidation threshold, and bSTX/STX oracle feed from bitstake-bstx-oracle. Users can borrow against stacked positions without unlocking."
    CONTRACT-OWNER   ;; placeholder — replace with lbSTX contract principal at deploy
    CONTRACT-OWNER   ;; placeholder — replace with oracle principal at deploy
    PROPOSED-LTV-BPS
    LIQUIDATION-THRESHOLD-BPS
    LIQUIDATION-BONUS-BPS
  ))
)
