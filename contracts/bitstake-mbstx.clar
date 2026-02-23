;; bitstake-mbstx.clar
;; mbSTX — Maxi Pool liquid staking token (Pool 3, 12-cycle lockup)
;; SIP-010 compliant

(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-fungible-token mbstx)

(define-constant CONTRACT-OWNER  tx-sender)
(define-constant ERR-NOT-OWNER   (err u100))
(define-constant ERR-NOT-SENDER  (err u101))
(define-constant ERR-ZERO        (err u103))

(define-data-var token-name    (string-ascii 32)           "Maxi bitstake STX")
(define-data-var token-symbol  (string-ascii 10)           "mbSTX")
(define-data-var token-decimals uint                       u6)
(define-data-var token-uri     (optional (string-utf8 256)) none)

(define-read-only (get-name)     (ok (var-get token-name)))
(define-read-only (get-symbol)   (ok (var-get token-symbol)))
(define-read-only (get-decimals) (ok (var-get token-decimals)))
(define-read-only (get-balance (account principal)) (ok (ft-get-balance mbstx account)))
(define-read-only (get-total-supply) (ok (ft-get-supply mbstx)))
(define-read-only (get-token-uri) (ok (var-get token-uri)))

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-SENDER)
    (asserts! (> amount u0) ERR-ZERO)
    (try! (ft-transfer? mbstx amount sender recipient))
    (match memo m (print m) 0x)
    (ok true)))

(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (ft-mint? mbstx amount recipient)))

(define-public (burn (amount uint) (owner principal))
  (begin
    (asserts! (is-eq tx-sender owner) ERR-NOT-SENDER)
    (ft-burn? mbstx amount owner)))

(define-public (set-token-uri (new-uri (optional (string-utf8 256))))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set token-uri new-uri)
    (ok true)))
