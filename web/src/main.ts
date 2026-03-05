import './style.css';

import { connect, request } from '@stacks/connect';
import {
  boolCV,
  cvToJSON,
  fetchCallReadOnlyFunction,
  principalCV,
  stringAsciiCV,
  uintCV,
  type ClarityValue,
} from '@stacks/transactions';

type AppNetwork = 'testnet' | 'mainnet' | 'devnet';

type AppConfig = {
  contractAddress: string;
  contractName: string;
  network: AppNetwork;
};

const STORAGE_KEY = 'stackescrow:config';

const state = {
  walletAddress: '',
};

const DEFAULT_CONFIG: AppConfig = {
  contractAddress: '',
  contractName: 'stack-escrow',
  network: 'testnet',
};

function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      contractAddress: parsed.contractAddress ?? DEFAULT_CONFIG.contractAddress,
      contractName: parsed.contractName ?? DEFAULT_CONFIG.contractName,
      network: (parsed.network as AppNetwork) ?? DEFAULT_CONFIG.network,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: AppConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function must<T extends Element>(selector: string): T {
  const node = document.querySelector(selector);
  if (!node) {
    throw new Error(`Missing element: ${selector}`);
  }
  return node as T;
}

function setStatus(message: string, mode: 'ok' | 'warn' | 'err' = 'ok'): void {
  const el = must<HTMLDivElement>('#status');
  el.textContent = message;
  el.dataset.mode = mode;
}

function setResult(message: string): void {
  must<HTMLPreElement>('#result').textContent = message;
}

function currentConfig(): AppConfig {
  const contractAddress = must<HTMLInputElement>('#contract-address').value.trim();
  const contractName = must<HTMLInputElement>('#contract-name').value.trim();
  const network = must<HTMLSelectElement>('#network').value as AppNetwork;

  const config: AppConfig = { contractAddress, contractName, network };
  saveConfig(config);
  return config;
}

function stxToMicrostx(input: string): bigint {
  const normalized = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new Error('Amount must be a number with up to 6 decimals (e.g. 1.25)');
  }

  const [whole, fraction = ''] = normalized.split('.');
  const wholePart = BigInt(whole) * 1_000_000n;
  const fractionalPart = BigInt((fraction + '000000').slice(0, 6));
  return wholePart + fractionalPart;
}

function parseUint(input: string, fieldName: string): bigint {
  const value = input.trim();
  if (!/^\d+$/.test(value)) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return BigInt(value);
}

function setWalletAddress(address: string): void {
  state.walletAddress = address;
  must<HTMLSpanElement>('#wallet-address').textContent = address || 'Not connected';
}

function resolveStxAddress(addresses: Array<{ symbol?: string; address: string }>): string {
  return addresses.find(addr => addr.symbol === 'STX')?.address ?? addresses[0]?.address ?? '';
}

async function connectWallet(): Promise<void> {
  const config = currentConfig();
  const result = await connect({ network: config.network });
  const stxAddress = resolveStxAddress(result.addresses);
  if (!stxAddress) {
    throw new Error('No wallet address returned');
  }
  setWalletAddress(stxAddress);
}

async function runContractCall(functionName: string, functionArgs: ClarityValue[]): Promise<void> {
  const config = currentConfig();

  if (!config.contractAddress || !config.contractName) {
    throw new Error('Set contract address and contract name first');
  }

  const contract = `${config.contractAddress}.${config.contractName}` as `${string}.${string}`;

  const result = await request('stx_callContract', {
    contract,
    functionName,
    functionArgs,
    network: config.network,
    address: state.walletAddress || undefined,
  });

  const txid = result.txid ?? 'signed (no txid returned by wallet)';
  setResult(JSON.stringify({ functionName, txid }, null, 2));
  setStatus(`Transaction submitted: ${txid}`, 'ok');
}

function bindCreateEscrow(): void {
  must<HTMLFormElement>('#create-form').addEventListener('submit', async event => {
    event.preventDefault();

    try {
      const formData = new FormData(event.currentTarget as HTMLFormElement);
      const payee = String(formData.get('payee') ?? '').trim();
      const arbiter = String(formData.get('arbiter') ?? '').trim();
      const amount = stxToMicrostx(String(formData.get('amount') ?? '0'));
      const expiresAt = parseUint(String(formData.get('expiresAt') ?? ''), 'Expiry block');
      const memo = String(formData.get('memo') ?? '').trim();

      await runContractCall('create-escrow', [
        principalCV(payee),
        principalCV(arbiter),
        uintCV(amount),
        uintCV(expiresAt),
        stringAsciiCV(memo),
      ]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Create escrow failed', 'err');
    }
  });
}

function bindSimpleUintForm(formId: string, functionName: string): void {
  must<HTMLFormElement>(formId).addEventListener('submit', async event => {
    event.preventDefault();

    try {
      const formData = new FormData(event.currentTarget as HTMLFormElement);
      const id = parseUint(String(formData.get('id') ?? ''), 'Escrow ID');
      await runContractCall(functionName, [uintCV(id)]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${functionName} failed`, 'err');
    }
  });
}

function bindResolveDispute(): void {
  must<HTMLFormElement>('#resolve-form').addEventListener('submit', async event => {
    event.preventDefault();

    try {
      const formData = new FormData(event.currentTarget as HTMLFormElement);
      const id = parseUint(String(formData.get('id') ?? ''), 'Escrow ID');
      const payToPayee = String(formData.get('payToPayee') ?? 'true') === 'true';

      await runContractCall('resolve-dispute', [uintCV(id), boolCV(payToPayee)]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'resolve-dispute failed', 'err');
    }
  });
}

function bindExtendExpiry(): void {
  must<HTMLFormElement>('#extend-form').addEventListener('submit', async event => {
    event.preventDefault();

    try {
      const formData = new FormData(event.currentTarget as HTMLFormElement);
      const id = parseUint(String(formData.get('id') ?? ''), 'Escrow ID');
      const newExpiry = parseUint(String(formData.get('newExpiry') ?? ''), 'New expiry block');

      await runContractCall('extend-expiry', [uintCV(id), uintCV(newExpiry)]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'extend-expiry failed', 'err');
    }
  });
}

function bindReadEscrow(): void {
  must<HTMLFormElement>('#read-form').addEventListener('submit', async event => {
    event.preventDefault();

    try {
      const formData = new FormData(event.currentTarget as HTMLFormElement);
      const id = parseUint(String(formData.get('id') ?? ''), 'Escrow ID');
      const config = currentConfig();

      if (!config.contractAddress || !config.contractName) {
        throw new Error('Set contract address and contract name first');
      }

      const response = await fetchCallReadOnlyFunction({
        contractAddress: config.contractAddress,
        contractName: config.contractName,
        functionName: 'get-escrow',
        functionArgs: [uintCV(id)],
        senderAddress: state.walletAddress || config.contractAddress,
        network: config.network,
      });

      setResult(JSON.stringify(cvToJSON(response), null, 2));
      setStatus('Fetched escrow data', 'ok');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'read failed', 'err');
    }
  });
}

function render(): void {
  const config = loadConfig();

  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <div class="shell">
      <header class="hero">
        <span class="hero-kicker">Stacks Escrow Workflow</span>
        <h1>StackEscrow MVP</h1>
        <p>Milestone escrow dApp for Stacks Builder Rewards (March 2026).</p>
        <div class="hero-chips">
          <span class="chip">Contract: <strong>stack-escrow</strong></span>
          <span class="chip">Target: <strong>testnet</strong></span>
        </div>
      </header>

      <div class="layout-grid">
        <section class="panel">
          <h2>Connection</h2>
          <p class="panel-intro">Set the deployed contract and connect a wallet before sending transactions.</p>
          <div class="grid two">
            <label>
              Network
              <select id="network">
                <option value="testnet" ${config.network === 'testnet' ? 'selected' : ''}>testnet</option>
                <option value="mainnet" ${config.network === 'mainnet' ? 'selected' : ''}>mainnet</option>
                <option value="devnet" ${config.network === 'devnet' ? 'selected' : ''}>devnet</option>
              </select>
            </label>

            <label>
              Contract Name
              <input id="contract-name" value="${config.contractName}" placeholder="stack-escrow" />
            </label>

            <label class="full">
              Contract Address
              <input id="contract-address" value="${config.contractAddress}" placeholder="SP..." />
            </label>
          </div>

          <div class="actions">
            <button id="connect-wallet" type="button">Connect Wallet</button>
            <span class="wallet-pill">Wallet <code id="wallet-address">Not connected</code></span>
          </div>
        </section>

        <section class="panel">
          <h2>Create Escrow</h2>
          <p class="panel-intro">Lock STX and assign payee + arbiter for a milestone payment.</p>
          <form id="create-form" class="grid two">
            <label>
              Payee Principal
              <input name="payee" required placeholder="SP..." />
            </label>
            <label>
              Arbiter Principal
              <input name="arbiter" required placeholder="SP..." />
            </label>
            <label>
              Amount (STX)
              <input name="amount" required placeholder="10.5" />
            </label>
            <label>
              Expiry Block Height
              <input name="expiresAt" required placeholder="500000" />
            </label>
            <label class="full">
              Memo
              <input name="memo" maxlength="120" placeholder="Milestone 1 payment" />
            </label>
            <button type="submit">Create Escrow</button>
          </form>
        </section>

        <section class="panel">
          <h2>Escrow Actions</h2>
          <p class="panel-intro">Run lifecycle actions by escrow ID after wallet confirmation.</p>
          <div class="action-grid">
            <form id="release-form" class="inline-form">
              <label>Escrow ID <input name="id" required placeholder="1" /></label>
              <button type="submit">Release</button>
            </form>

            <form id="refund-form" class="inline-form">
              <label>Escrow ID <input name="id" required placeholder="1" /></label>
              <button type="submit">Refund</button>
            </form>

            <form id="dispute-form" class="inline-form">
              <label>Escrow ID <input name="id" required placeholder="1" /></label>
              <button type="submit">Raise Dispute</button>
            </form>

            <form id="resolve-form" class="inline-form">
              <label>Escrow ID <input name="id" required placeholder="1" /></label>
              <label>
                Decision
                <select name="payToPayee">
                  <option value="true">Pay Payee</option>
                  <option value="false">Refund Payer</option>
                </select>
              </label>
              <button type="submit">Resolve Dispute</button>
            </form>

            <form id="extend-form" class="inline-form full">
              <label>Escrow ID <input name="id" required placeholder="1" /></label>
              <label>New Expiry <input name="newExpiry" required placeholder="510000" /></label>
              <button type="submit">Extend Expiry</button>
            </form>
          </div>
        </section>

        <section class="panel">
          <h2>Read Contract</h2>
          <p class="panel-intro">Fetch latest escrow state directly from chain data.</p>
          <form id="read-form" class="inline-form">
            <label>Escrow ID <input name="id" required placeholder="1" /></label>
            <button type="submit">Fetch Escrow</button>
          </form>
        </section>

        <section class="panel panel-output">
          <h2>Output</h2>
          <div id="status" data-mode="ok">Ready</div>
          <pre id="result">{}</pre>
        </section>
      </div>
    </div>
  `;

  bindCreateEscrow();
  bindSimpleUintForm('#release-form', 'release');
  bindSimpleUintForm('#refund-form', 'refund');
  bindSimpleUintForm('#dispute-form', 'raise-dispute');
  bindResolveDispute();
  bindExtendExpiry();
  bindReadEscrow();

  must<HTMLButtonElement>('#connect-wallet').addEventListener('click', async () => {
    try {
      await connectWallet();
      setStatus('Wallet connected', 'ok');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet connect failed';
      if (/cancel/i.test(message)) {
        setStatus('Wallet connection cancelled', 'warn');
      } else if (/no wallet address/i.test(message)) {
        setStatus('Connected wallet returned no address', 'err');
      } else {
        setStatus(message, 'err');
      }
    }
  });

  must<HTMLSelectElement>('#network').addEventListener('change', () => currentConfig());
  must<HTMLInputElement>('#contract-address').addEventListener('change', () => currentConfig());
  must<HTMLInputElement>('#contract-name').addEventListener('change', () => currentConfig());
}

render();
