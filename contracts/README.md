# StackEscrow Contract

File: `stack-escrow.clar`

## Status Values

- `u1`: Open
- `u2`: Disputed
- `u3`: Released
- `u4`: Refunded

## Errors

- `u100`: Escrow not found
- `u101`: Unauthorized caller
- `u102`: Invalid status transition
- `u103`: Invalid amount
- `u104`: Invalid expiry
- `u105`: Invalid party configuration

## Public Functions

- `create-escrow(payee, arbiter, amount, expires-at, memo)`
- `release(id)`
- `raise-dispute(id)`
- `resolve-dispute(id, pay-to-payee)`
- `refund(id)`
- `extend-expiry(id, new-expiry)`

## Read-only Functions

- `get-escrow(id)`
- `get-next-escrow-id()`

## Notes

- Amount uses microSTX.
- `refund` by payer requires `block-height >= expires-at`.
- Arbiter can resolve disputes and force settlement when needed.

