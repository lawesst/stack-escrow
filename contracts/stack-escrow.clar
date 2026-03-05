;; StackEscrow: milestone escrow contract for STX payments.
;; Roles:
;; - payer: funds escrow
;; - payee: receives funds on release
;; - arbiter: resolves disputes / can force settlement

(define-constant ERR_NOT_FOUND u100)
(define-constant ERR_UNAUTHORIZED u101)
(define-constant ERR_INVALID_STATUS u102)
(define-constant ERR_INVALID_AMOUNT u103)
(define-constant ERR_INVALID_EXPIRY u104)
(define-constant ERR_INVALID_PARTY u105)

(define-constant STATUS_OPEN u1)
(define-constant STATUS_DISPUTED u2)
(define-constant STATUS_RELEASED u3)
(define-constant STATUS_REFUNDED u4)

(define-data-var next-escrow-id uint u1)

(define-map escrows
  { id: uint }
  {
    payer: principal,
    payee: principal,
    arbiter: principal,
    amount: uint,
    created-at: uint,
    expires-at: uint,
    status: uint,
    memo: (string-ascii 120)
  }
)

(define-read-only (get-escrow (id uint))
  (ok (map-get? escrows { id: id }))
)

(define-read-only (get-next-escrow-id)
  (ok (var-get next-escrow-id))
)

(define-public (create-escrow
  (payee principal)
  (arbiter principal)
  (amount uint)
  (expires-at uint)
  (memo (string-ascii 120))
)
  (begin
    (asserts! (> amount u0) (err ERR_INVALID_AMOUNT))
    (asserts! (> expires-at block-height) (err ERR_INVALID_EXPIRY))
    (asserts! (not (is-eq payee tx-sender)) (err ERR_INVALID_PARTY))
    (asserts! (and (not (is-eq arbiter tx-sender)) (not (is-eq arbiter payee))) (err ERR_INVALID_PARTY))

    ;; Move funds from payer into this contract's balance.
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))

    (let ((id (var-get next-escrow-id)))
      (map-set escrows
        { id: id }
        {
          payer: tx-sender,
          payee: payee,
          arbiter: arbiter,
          amount: amount,
          created-at: block-height,
          expires-at: expires-at,
          status: STATUS_OPEN,
          memo: memo
        }
      )
      (var-set next-escrow-id (+ id u1))
      (print {
        event: "create-escrow",
        id: id,
        payer: tx-sender,
        payee: payee,
        amount: amount,
        expires-at: expires-at
      })
      (ok id)
    )
  )
)

(define-public (release (id uint))
  (let ((escrow (unwrap! (map-get? escrows { id: id }) (err ERR_NOT_FOUND))))
    (begin
      (asserts!
        (or (is-eq (get status escrow) STATUS_OPEN) (is-eq (get status escrow) STATUS_DISPUTED))
        (err ERR_INVALID_STATUS)
      )
      (asserts!
        (or (is-eq tx-sender (get payer escrow)) (is-eq tx-sender (get arbiter escrow)))
        (err ERR_UNAUTHORIZED)
      )

      (try! (as-contract (stx-transfer? (get amount escrow) tx-sender (get payee escrow))))

      (map-set escrows { id: id } (merge escrow { status: STATUS_RELEASED }))
      (print { event: "release", id: id, by: tx-sender, to: (get payee escrow), amount: (get amount escrow) })
      (ok true)
    )
  )
)

(define-public (raise-dispute (id uint))
  (let ((escrow (unwrap! (map-get? escrows { id: id }) (err ERR_NOT_FOUND))))
    (begin
      (asserts! (is-eq (get status escrow) STATUS_OPEN) (err ERR_INVALID_STATUS))
      (asserts!
        (or (is-eq tx-sender (get payer escrow)) (is-eq tx-sender (get payee escrow)))
        (err ERR_UNAUTHORIZED)
      )

      (map-set escrows { id: id } (merge escrow { status: STATUS_DISPUTED }))
      (print { event: "raise-dispute", id: id, by: tx-sender })
      (ok true)
    )
  )
)

(define-public (resolve-dispute (id uint) (pay-to-payee bool))
  (let ((escrow (unwrap! (map-get? escrows { id: id }) (err ERR_NOT_FOUND))))
    (begin
      (asserts! (is-eq (get status escrow) STATUS_DISPUTED) (err ERR_INVALID_STATUS))
      (asserts! (is-eq tx-sender (get arbiter escrow)) (err ERR_UNAUTHORIZED))

      (let (
          (recipient (if pay-to-payee (get payee escrow) (get payer escrow)))
          (new-status (if pay-to-payee STATUS_RELEASED STATUS_REFUNDED))
        )
        (try! (as-contract (stx-transfer? (get amount escrow) tx-sender recipient)))
        (map-set escrows { id: id } (merge escrow { status: new-status }))
        (print { event: "resolve-dispute", id: id, by: tx-sender, to: recipient, amount: (get amount escrow) })
        (ok true)
      )
    )
  )
)

(define-public (refund (id uint))
  (let ((escrow (unwrap! (map-get? escrows { id: id }) (err ERR_NOT_FOUND))))
    (begin
      (asserts!
        (or (is-eq (get status escrow) STATUS_OPEN) (is-eq (get status escrow) STATUS_DISPUTED))
        (err ERR_INVALID_STATUS)
      )
      (asserts!
        (or
          (is-eq tx-sender (get arbiter escrow))
          (and
            (is-eq tx-sender (get payer escrow))
            (>= block-height (get expires-at escrow))
          )
        )
        (err ERR_UNAUTHORIZED)
      )

      (try! (as-contract (stx-transfer? (get amount escrow) tx-sender (get payer escrow))))

      (map-set escrows { id: id } (merge escrow { status: STATUS_REFUNDED }))
      (print { event: "refund", id: id, by: tx-sender, to: (get payer escrow), amount: (get amount escrow) })
      (ok true)
    )
  )
)

(define-public (extend-expiry (id uint) (new-expiry uint))
  (let ((escrow (unwrap! (map-get? escrows { id: id }) (err ERR_NOT_FOUND))))
    (begin
      (asserts! (is-eq tx-sender (get payer escrow)) (err ERR_UNAUTHORIZED))
      (asserts! (is-eq (get status escrow) STATUS_OPEN) (err ERR_INVALID_STATUS))
      (asserts!
        (and (> new-expiry block-height) (> new-expiry (get expires-at escrow)))
        (err ERR_INVALID_EXPIRY)
      )

      (map-set escrows { id: id } (merge escrow { expires-at: new-expiry }))
      (print { event: "extend-expiry", id: id, by: tx-sender, new-expiry: new-expiry })
      (ok true)
    )
  )
)
