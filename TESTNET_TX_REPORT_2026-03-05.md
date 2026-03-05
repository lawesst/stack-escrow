# StackEscrow Testnet Transaction Report (2026-03-05)

Contract:
- `ST2QCBMMQPNYVY2S0XYAAZ5P00V7FM8B0S6P4TKRQ.stack-escrow`

Executed by:
- `ST2QCBMMQPNYVY2S0XYAAZ5P00V7FM8B0S6P4TKRQ` (testnet deployer)

Batch run timestamp (UTC):
- `2026-03-05T13:13:53.463Z`

## Confirmed Transactions

1. `create-escrow` (escrow id `1`)
   - txid: `0xed219e50e8a2456e1e4ed32983b6cba3bee29b1745ac84b1f42a911d63288fa5`
   - block: `3879428`
   - explorer: https://explorer.hiro.so/txid/0xed219e50e8a2456e1e4ed32983b6cba3bee29b1745ac84b1f42a911d63288fa5?chain=testnet

2. `extend-expiry` (escrow id `1`)
   - txid: `0x5fa48a6a6b93228d64ec67b9ca9f450f835d24cf333b4635cf54405d3592af3e`
   - block: `3879429`
   - explorer: https://explorer.hiro.so/txid/0x5fa48a6a6b93228d64ec67b9ca9f450f835d24cf333b4635cf54405d3592af3e?chain=testnet

3. `release` (escrow id `1`)
   - txid: `0x5092158b03e2fb7ed6c859ef1d2e85451458d9f54d714df4ec13e16965728d85`
   - block: `3879430`
   - explorer: https://explorer.hiro.so/txid/0x5092158b03e2fb7ed6c859ef1d2e85451458d9f54d714df4ec13e16965728d85?chain=testnet

4. `create-escrow` (escrow id `2`)
   - txid: `0x15b8d8337b3c767b7e7933992b22d0221e777b98385ebd41207750d9b72f867e`
   - block: `3879431`
   - explorer: https://explorer.hiro.so/txid/0x15b8d8337b3c767b7e7933992b22d0221e777b98385ebd41207750d9b72f867e?chain=testnet

5. `raise-dispute` (escrow id `2`)
   - txid: `0x105e21016528a34091e00161da78f4b72bc4298234fb929c3750e53bad5f1306`
   - block: `3879432`
   - explorer: https://explorer.hiro.so/txid/0x105e21016528a34091e00161da78f4b72bc4298234fb929c3750e53bad5f1306?chain=testnet

6. `release` (escrow id `2`)
   - txid: `0x1201ad391338cd7545bb94dc2c9a4c6ad4c8f6cd0268120a100458cf0e6f5ec4`
   - block: `3879433`
   - explorer: https://explorer.hiro.so/txid/0x1201ad391338cd7545bb94dc2c9a4c6ad4c8f6cd0268120a100458cf0e6f5ec4?chain=testnet

## Contract Explorer Page

- https://explorer.hiro.so/address/ST2QCBMMQPNYVY2S0XYAAZ5P00V7FM8B0S6P4TKRQ.stack-escrow?chain=testnet

## State Check

Read-only verification after batch:
- `get-escrow(1)` status = `u3` (released)
- `get-escrow(2)` status = `u3` (released)

## Reproducible Runner

- Script: `scripts/run-testnet-txs.mjs`
- Run:
  - `cd /Users/vicgunga/Downloads/stack`
  - `node scripts/run-testnet-txs.mjs`
