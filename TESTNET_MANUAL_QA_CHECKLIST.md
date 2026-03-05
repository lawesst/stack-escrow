# StackEscrow Testnet Manual QA Checklist (15 Steps)

Use this checklist with a real Stacks wallet (e.g. Leather/Xverse) on **testnet** and capture screenshots/video for competition evidence.

Project context:
- dApp URL (local): `http://localhost:5173`
- Contract: `ST2QCBMMQPNYVY2S0XYAAZ5P00V7FM8B0S6P4TKRQ.stack-escrow`
- Network: `testnet`

Evidence legend:
- Screenshot ID: filename or timestamp of screenshot/video clip.
- TxID: paste transaction ID from wallet/explorer.

| # | Test Step | Expected Result | Evidence (fill) |
|---|---|---|---|
| 1 | Start app (`cd web && npm run dev`) and open `http://localhost:5173`. | UI loads with `StackEscrow MVP` header and no console crash. | Screenshot ID: ___ |
| 2 | In Connection section, confirm Network = `testnet`. | Network selector shows `testnet`. | Screenshot ID: ___ |
| 3 | Set Contract Address = `ST2QCBMMQPNYVY2S0XYAAZ5P00V7FM8B0S6P4TKRQ` and Contract Name = `stack-escrow`. Refresh page. | Values persist after reload (localStorage config works). | Screenshot ID: ___ |
| 4 | Click `Connect Wallet`, approve in wallet extension. | Status becomes `Wallet connected` and wallet address displays. | Screenshot ID: ___ |
| 5 | Click `Refresh Address`. | Status becomes `Wallet address refreshed`; displayed address matches wallet. | Screenshot ID: ___ |
| 6 | Try `Create Escrow` with invalid amount (e.g. `abc`). | Validation error shown; no wallet prompt. | Screenshot ID: ___ |
| 7 | Create Escrow with valid values: payee, arbiter, amount `0.1`, expiry block in future, memo `QA-1`. Approve tx. | Wallet prompt appears; status shows `Transaction submitted`; tx confirms on testnet explorer. | TxID: ___ / Screenshot ID: ___ |
| 8 | Use `Fetch Escrow` with ID `1` (or created ID). | Output JSON returns escrow data with status `open` semantics and saved fields. | Screenshot ID: ___ |
| 9 | As payer, click `Extend Expiry` on same escrow with higher block. Approve tx. | Extend transaction submits and confirms. | TxID: ___ / Screenshot ID: ___ |
| 10 | As payer, click `Raise Dispute` for escrow ID. Approve tx. | Dispute transaction submits and confirms. | TxID: ___ / Screenshot ID: ___ |
| 11 | Try `Resolve Dispute` from non-arbiter wallet (switch wallet/account if needed). | Contract call is rejected (wallet/broadcast error or chain reject). | Screenshot ID: ___ |
| 12 | Switch to arbiter wallet/account and run `Resolve Dispute` with `Pay Payee`. Approve tx. | Resolve transaction submits and confirms successfully. | TxID: ___ / Screenshot ID: ___ |
| 13 | Create second escrow (`QA-2`) then attempt `Refund` as payer **before expiry**. | Refund is rejected before expiry (unauthorized/invalid state path). | Screenshot ID: ___ |
| 14 | After expiry (or with arbiter authority), execute valid `Refund` on second escrow. | Refund transaction submits and confirms; escrow status becomes refunded. | TxID: ___ / Screenshot ID: ___ |
| 15 | Final verification: fetch escrow IDs used and open explorer pages for each tx + contract page. | Explorer shows successful transactions and deployed contract source on testnet. | Contract URL + Tx URLs: ___ |

## Submission Bundle Checklist

1. Include this completed checklist (filled evidence column).
2. Include 1 short screen recording covering steps 4, 7, 8, 12, 15.
3. Include plain-text list of all TxIDs in order.
4. Include contract ID and network (`testnet`) in submission description.
