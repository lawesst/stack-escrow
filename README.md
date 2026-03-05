# StackEscrow

Milestone escrow dApp on Stacks for freelancer/client payments.

This MVP includes:
- A Clarity contract for escrow lifecycle management.
- A web UI that connects to a Stacks wallet and sends contract calls.
- A read-only escrow viewer to verify on-chain state.
- A Clarinet-compatible test/deploy setup with automated simnet tests.

## Project Structure

- `contracts/stack-escrow.clar`: Clarity smart contract.
- `Clarinet.toml`: Clarinet project manifest.
- `settings/`: Devnet/Testnet/Mainnet network settings.
- `tests/stack-escrow.test.ts`: contract behavior tests via simnet.
- `vitest.config.ts`: Clarinet-enabled Vitest configuration.
- `web/`: Vite TypeScript frontend using `@stacks/connect` and `@stacks/transactions`.
- `TESTNET_MANUAL_QA_CHECKLIST.md`: 15-step real-wallet testnet QA checklist for submission evidence.

## Escrow Lifecycle

1. `create-escrow`: payer locks STX in contract.
2. `release`: payer (or arbiter) releases funds to payee.
3. `raise-dispute`: payer/payee flags escrow as disputed.
4. `resolve-dispute`: arbiter resolves to payee or payer.
5. `refund`: payer can refund after expiry, or arbiter can force refund.
6. `extend-expiry`: payer extends expiry before completion.

## Quick Start (Frontend)

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`.

## Quick Start (Contract Validation)

```bash
cd /Users/vicgunga/Downloads/stack
npm install
npm test
```

The tests validate:
- escrow creation and state writes
- authorized/unauthorized release behavior
- dispute raise + arbiter resolution
- expiry-based refunds
- expiry extension rules

## Clarinet Deployment Workflow

If Clarinet CLI is installed:

```bash
# validate contract syntax and project config
clarinet check

# generate deployment plans
clarinet deployments generate --devnet
clarinet deployments generate --testnet

# apply testnet plan (after filling settings/Testnet.toml mnemonic)
clarinet deployments apply --testnet
```

Before deploying, update:
- `settings/Testnet.toml` deployer mnemonic
- `settings/Mainnet.toml` deployer mnemonic (for production)

## Contract Deployment

Deploy `contracts/stack-escrow.clar` with your preferred Stacks flow (Clarinet / Hiro tooling / wallet deploy).

After deployment, set these in the app:
- `Contract Address` (your deployer address)
- `Contract Name` (`stack-escrow`)
- `Network` (`testnet` recommended for MVP)

## Core Contract Functions

- `create-escrow(payee, arbiter, amount, expires-at, memo)`
- `release(id)`
- `raise-dispute(id)`
- `resolve-dispute(id, pay-to-payee)`
- `refund(id)`
- `extend-expiry(id, new-expiry)`
- `get-escrow(id)`
- `get-next-escrow-id()`

## Builder Rewards Alignment (March 2026)

This app is designed to generate real activity signals relevant to Stacks Builder Rewards:
- Ongoing contributor development commits.
- Frequent contract transactions and fees.
- Optional package/API surface for npm distribution in later iterations.

## Suggested Next Steps

1. Add milestone-based partial release logic (multiple tranches per escrow).
2. Add SIP-010 token escrow support (USDA/other tokens).
3. Add backend indexer for escrow analytics and search.
4. Add frontend pages for escrow history + role-based dashboards.
