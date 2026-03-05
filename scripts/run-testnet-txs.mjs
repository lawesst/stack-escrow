import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { bytesToHex } from '@stacks/common';
import { STACKS_TESTNET } from '@stacks/network';
import {
  PostConditionMode,
  broadcastTransaction,
  cvToValue,
  fetchCallReadOnlyFunction,
  fetchNonce,
  getAddressFromPrivateKey,
  makeContractCall,
  principalCV,
  stringAsciiCV,
  uintCV,
} from '@stacks/transactions';

const CONTRACT_ADDRESS = 'ST2QCBMMQPNYVY2S0XYAAZ5P00V7FM8B0S6P4TKRQ';
const CONTRACT_NAME = 'stack-escrow';
const PAYEE = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
const ARBITER = 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC';
const STACKS_API = 'https://api.testnet.hiro.so';

function readTomlValue(content, key) {
  const match = content.match(new RegExp(`${key}\\s*=\\s*\"([^\"]+)\"`));
  if (!match) {
    throw new Error(`Missing ${key} in settings/Testnet.toml`);
  }
  return match[1];
}

function strip0x(txid) {
  return txid.startsWith('0x') ? txid.slice(2) : txid;
}

function explorerTxUrl(txid) {
  return `https://explorer.hiro.so/txid/0x${strip0x(txid)}?chain=testnet`;
}

async function waitForTx(txid, timeoutMs = 180000, pollMs = 5000) {
  const normalized = `0x${strip0x(txid)}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${STACKS_API}/extended/v1/tx/${normalized}`);
    if (res.ok) {
      const body = await res.json();
      const status = body.tx_status;
      if (status === 'success') return body;
      if (status && status !== 'pending') {
        throw new Error(`Transaction ${normalized} ended with status ${status}`);
      }
    }
    await sleep(pollMs);
  }
  throw new Error(`Timed out waiting for confirmation: ${normalized}`);
}

async function getTipHeight() {
  const res = await fetch(`${STACKS_API}/v2/info`);
  if (!res.ok) throw new Error(`Failed to fetch chain info: ${res.status}`);
  const body = await res.json();
  return BigInt(body.stacks_tip_height);
}

function derivePrivateKeyFromTestnetToml() {
  const settings = readFileSync('settings/Testnet.toml', 'utf8');
  const mnemonic = readTomlValue(settings, 'mnemonic');
  const derivation = readTomlValue(settings, 'derivation');
  const seed = mnemonicToSeedSync(mnemonic, '');
  const hd = HDKey.fromMasterSeed(seed);
  const child = hd.derive(derivation);
  if (!child.privateKey) throw new Error('Failed to derive private key');
  return `${bytesToHex(child.privateKey)}01`;
}

async function getNextEscrowId(senderAddress) {
  const response = await fetchCallReadOnlyFunction({
    network: STACKS_TESTNET,
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-next-escrow-id',
    functionArgs: [],
    senderAddress,
  });
  const value = cvToValue(response);
  if (!value || value.type !== 'uint') {
    throw new Error(`Unexpected get-next-escrow-id response: ${JSON.stringify(value)}`);
  }
  return BigInt(value.value);
}

async function main() {
  const senderKey = derivePrivateKeyFromTestnetToml();
  const senderAddress = getAddressFromPrivateKey(senderKey, 'testnet');

  if (senderAddress !== CONTRACT_ADDRESS) {
    throw new Error(
      `Derived address ${senderAddress} does not match expected deployer ${CONTRACT_ADDRESS}`
    );
  }

  const baseEscrowId = await getNextEscrowId(senderAddress);
  const tip = await getTipHeight();
  let nonce = await fetchNonce({ address: senderAddress, network: STACKS_TESTNET });

  const expiryA = tip + 120n;
  const expiryANew = tip + 220n;
  const expiryB = tip + 260n;

  const steps = [
    {
      label: 'create-escrow-A',
      functionName: 'create-escrow',
      args: [
        principalCV(PAYEE),
        principalCV(ARBITER),
        uintCV(1_000_000n),
        uintCV(expiryA),
        stringAsciiCV(`real-testnet-A-${Date.now()}`),
      ],
      escrowId: baseEscrowId,
    },
    {
      label: 'extend-expiry-A',
      functionName: 'extend-expiry',
      args: [uintCV(baseEscrowId), uintCV(expiryANew)],
      escrowId: baseEscrowId,
    },
    {
      label: 'release-A',
      functionName: 'release',
      args: [uintCV(baseEscrowId)],
      escrowId: baseEscrowId,
    },
    {
      label: 'create-escrow-B',
      functionName: 'create-escrow',
      args: [
        principalCV(PAYEE),
        principalCV(ARBITER),
        uintCV(1_500_000n),
        uintCV(expiryB),
        stringAsciiCV(`real-testnet-B-${Date.now()}`),
      ],
      escrowId: baseEscrowId + 1n,
    },
    {
      label: 'raise-dispute-B',
      functionName: 'raise-dispute',
      args: [uintCV(baseEscrowId + 1n)],
      escrowId: baseEscrowId + 1n,
    },
    {
      label: 'release-B',
      functionName: 'release',
      args: [uintCV(baseEscrowId + 1n)],
      escrowId: baseEscrowId + 1n,
    },
  ];

  const results = [];

  for (const step of steps) {
    const tx = await makeContractCall({
      network: STACKS_TESTNET,
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: step.functionName,
      functionArgs: step.args,
      senderKey,
      nonce,
      postConditionMode: PostConditionMode.Allow,
    });

    const broadcast = await broadcastTransaction({ transaction: tx, network: STACKS_TESTNET });
    if (!('txid' in broadcast) || !broadcast.txid) {
      throw new Error(`Broadcast failed for ${step.label}: ${JSON.stringify(broadcast)}`);
    }

    const confirmed = await waitForTx(broadcast.txid);
    results.push({
      label: step.label,
      functionName: step.functionName,
      escrowId: step.escrowId.toString(),
      txid: `0x${strip0x(broadcast.txid)}`,
      status: confirmed.tx_status,
      blockHeight: confirmed.block_height,
      explorer: explorerTxUrl(broadcast.txid),
    });

    nonce += 1n;
    await sleep(2000);
  }

  const output = {
    senderAddress,
    contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
    baseEscrowId: baseEscrowId.toString(),
    runAtUtc: new Date().toISOString(),
    transactions: results,
    contractExplorer: `https://explorer.hiro.so/address/${CONTRACT_ADDRESS}.${CONTRACT_NAME}?chain=testnet`,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
