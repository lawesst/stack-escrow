# StackEscrow

StackEscrow is a Stacks testnet escrow MVP for milestone-based STX payments.

## Scope

- Clarity smart contract for escrow lifecycle management.
- Web UI for wallet connection, contract actions, and read-only state queries.
- Automated contract tests (Clarinet + Vitest).
- Manual testnet QA checklist for submission evidence.

## Repository Layout

- `contracts/stack-escrow.clar` - main contract.
- `tests/stack-escrow.test.ts` - contract tests.
- `settings/` - Clarinet network configs (Devnet/Testnet/Mainnet).
- `deployments/` - generated deployment plans.
- `web/` - Vite TypeScript frontend.
- `TESTNET_MANUAL_QA_CHECKLIST.md` - real-wallet testnet QA steps.

## Prerequisites

- Node.js 20+
- npm
- Clarinet CLI (`brew install clarinet`) for deployment

## Local Development

### Frontend

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`.

### Contract Tests

```bash
cd /Users/vicgunga/Downloads/stack
npm install
npm test
```

## Testnet Deployment

1. Set your deployer mnemonic in `settings/Testnet.toml`.
2. Validate contract and config:

```bash
clarinet check
clarinet deployments check
```

3. Generate and apply testnet plan:

```bash
clarinet deployments generate --testnet
clarinet deployments apply --testnet
```

4. In the UI, set:
- `Network`: `testnet`
- `Contract Address`: your deployer address
- `Contract Name`: `stack-escrow`

## Contract API

- `create-escrow(payee, arbiter, amount, expires-at, memo)`
- `release(id)`
- `raise-dispute(id)`
- `resolve-dispute(id, pay-to-payee)`
- `refund(id)`
- `extend-expiry(id, new-expiry)`
- `get-escrow(id)`
- `get-next-escrow-id()`

## Security Notes

- Never commit a real mnemonic or private key.
- `settings/Testnet.toml` is intentionally committed with a placeholder mnemonic.
