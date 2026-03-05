import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();
const showConnectMock = vi.fn();
const fetchCallReadOnlyFunctionMock = vi.fn();

const CONTRACT_ADDRESS = 'ST2QCBMMQPNYVY2S0XYAAZ5P00V7FM8B0S6P4TKRQ';
const WALLET_ADDRESS = 'STTESTWALLET1234567890';

vi.mock('@stacks/connect', () => ({
  request: (...args: unknown[]) => requestMock(...args),
  showConnect: (...args: unknown[]) => showConnectMock(...args),
}));

vi.mock('@stacks/transactions', () => ({
  boolCV: (value: boolean) => ({ type: 'bool', value }),
  cvToJSON: (value: unknown) => ({ value }),
  fetchCallReadOnlyFunction: (...args: unknown[]) => fetchCallReadOnlyFunctionMock(...args),
  principalCV: (value: string) => ({ type: 'principal', value }),
  stringAsciiCV: (value: string) => ({ type: 'string-ascii', value }),
  uintCV: (value: bigint) => ({ type: 'uint', value: value.toString() }),
}));

type BootOptions = {
  clearStorage?: boolean;
};

function queryOrFail<T extends Element>(selector: string): T {
  const node = document.querySelector(selector);
  if (!node) {
    throw new Error(`Missing element: ${selector}`);
  }
  return node as T;
}

function byIdOrFail<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing element id: ${id}`);
  }
  return node as T;
}

function statusText(): string {
  return byIdOrFail<HTMLDivElement>('status').textContent ?? '';
}

function statusMode(): string | undefined {
  return byIdOrFail<HTMLDivElement>('status').dataset.mode;
}

function setFieldValue(selector: string, value: string): void {
  const field = queryOrFail<HTMLInputElement | HTMLSelectElement>(selector);
  field.value = value;
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

function setInputValue(selector: string, value: string): void {
  const field = queryOrFail<HTMLInputElement>(selector);
  field.value = value;
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function submitForm(selector: string): Promise<void> {
  queryOrFail<HTMLFormElement>(selector).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await flush();
}

async function click(selector: string): Promise<void> {
  queryOrFail<HTMLButtonElement>(selector).click();
  await flush();
}

async function bootApp(options: BootOptions = {}): Promise<void> {
  if (options.clearStorage ?? true) {
    localStorage.clear();
  }
  document.body.innerHTML = '<div id="app"></div>';
  vi.resetModules();
  await import('./main');
  await flush();
}

beforeEach(() => {
  requestMock.mockReset();
  showConnectMock.mockReset();
  fetchCallReadOnlyFunctionMock.mockReset();
});

describe('StackEscrow UI (testnet)', () => {
  it('renders default UI with testnet selected', async () => {
    await bootApp();

    expect(queryOrFail<HTMLHeadingElement>('h1').textContent).toContain('StackEscrow MVP');
    expect(queryOrFail<HTMLSelectElement>('#network').value).toBe('testnet');
    expect(queryOrFail<HTMLInputElement>('#contract-name').value).toBe('stack-escrow');
  });

  it('persists and reloads connection config from localStorage', async () => {
    await bootApp();

    setFieldValue('#contract-address', CONTRACT_ADDRESS);
    setFieldValue('#contract-name', 'stack-escrow');
    setFieldValue('#network', 'mainnet');

    const stored = localStorage.getItem('stackescrow:config');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '{}')).toEqual({
      contractAddress: CONTRACT_ADDRESS,
      contractName: 'stack-escrow',
      network: 'mainnet',
    });

    await bootApp({ clearStorage: false });

    expect(queryOrFail<HTMLInputElement>('#contract-address').value).toBe(CONTRACT_ADDRESS);
    expect(queryOrFail<HTMLInputElement>('#contract-name').value).toBe('stack-escrow');
    expect(queryOrFail<HTMLSelectElement>('#network').value).toBe('mainnet');
  });

  it('refreshes wallet address successfully', async () => {
    requestMock.mockImplementation(async (method: string) => {
      if (method === 'stx_getAddresses') {
        return { addresses: [{ symbol: 'STX', address: WALLET_ADDRESS }] };
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    await bootApp();
    await click('#refresh-wallet');

    expect(byIdOrFail<HTMLElement>('wallet-address').textContent).toBe(WALLET_ADDRESS);
    expect(statusText()).toContain('Wallet address refreshed');
    expect(statusMode()).toBe('ok');
    expect(requestMock).toHaveBeenCalledWith('stx_getAddresses', { network: 'testnet' });
  });

  it('shows refresh wallet error when provider request fails', async () => {
    requestMock.mockRejectedValue(new Error('Failed to refresh wallet address'));

    await bootApp();
    await click('#refresh-wallet');

    expect(statusText()).toContain('Failed to refresh wallet address');
    expect(statusMode()).toBe('err');
  });

  it('connect-wallet flow sets connected status after onFinish', async () => {
    requestMock.mockImplementation(async (method: string) => {
      if (method === 'stx_getAddresses') {
        return { addresses: [{ symbol: 'STX', address: WALLET_ADDRESS }] };
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    showConnectMock.mockImplementation(async ({ onFinish }: { onFinish: () => Promise<void> }) => onFinish());

    await bootApp();
    await click('#connect-wallet');

    expect(showConnectMock).toHaveBeenCalledTimes(1);
    const args = showConnectMock.mock.calls[0][0] as { appDetails?: { name?: string }; redirectTo?: string };
    expect(args.appDetails?.name).toBe('StackEscrow');
    expect(args.redirectTo).toBe('/');
    expect(statusText()).toContain('Wallet connected');
    expect(statusMode()).toBe('ok');
  });

  it('connect-wallet flow marks cancel as warning', async () => {
    showConnectMock.mockImplementation(async ({ onCancel }: { onCancel: () => void }) => onCancel());

    await bootApp();
    await click('#connect-wallet');

    expect(statusText()).toContain('Wallet connection cancelled');
    expect(statusMode()).toBe('warn');
  });

  it('create form rejects invalid STX amount format', async () => {
    await bootApp();

    setInputValue('#create-form [name="payee"]', 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
    setInputValue('#create-form [name="arbiter"]', 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC');
    setInputValue('#create-form [name="amount"]', 'abc');
    setInputValue('#create-form [name="expiresAt"]', '3879999');
    setInputValue('#create-form [name="memo"]', 'Milestone 1');

    await submitForm('#create-form');

    expect(statusText()).toContain('Amount must be a number with up to 6 decimals');
    expect(statusMode()).toBe('err');
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('create form rejects non-integer expiry', async () => {
    await bootApp();

    setInputValue('#create-form [name="payee"]', 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
    setInputValue('#create-form [name="arbiter"]', 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC');
    setInputValue('#create-form [name="amount"]', '5.5');
    setInputValue('#create-form [name="expiresAt"]', '10.5');
    setInputValue('#create-form [name="memo"]', 'Milestone 2');

    await submitForm('#create-form');

    expect(statusText()).toContain('Expiry block must be a positive integer');
    expect(statusMode()).toBe('err');
  });

  it('create form submits create-escrow call payload', async () => {
    requestMock.mockImplementation(async (method: string) => {
      if (method === 'stx_callContract') {
        return { txid: '0xcreate' };
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    await bootApp();
    setFieldValue('#contract-address', CONTRACT_ADDRESS);

    setInputValue('#create-form [name="payee"]', 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
    setInputValue('#create-form [name="arbiter"]', 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC');
    setInputValue('#create-form [name="amount"]', '10.25');
    setInputValue('#create-form [name="expiresAt"]', '3880000');
    setInputValue('#create-form [name="memo"]', 'Milestone 3');

    await submitForm('#create-form');

    expect(requestMock).toHaveBeenCalledTimes(1);
    const [method, payload] = requestMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(method).toBe('stx_callContract');
    expect(payload.contract).toBe(`${CONTRACT_ADDRESS}.stack-escrow`);
    expect(payload.functionName).toBe('create-escrow');
    expect(payload.network).toBe('testnet');
    expect(payload.functionArgs).toEqual([
      { type: 'principal', value: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG' },
      { type: 'principal', value: 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC' },
      { type: 'uint', value: '10250000' },
      { type: 'uint', value: '3880000' },
      { type: 'string-ascii', value: 'Milestone 3' },
    ]);
    expect(statusText()).toContain('Transaction submitted: 0xcreate');
    expect(statusMode()).toBe('ok');
  });

  it('release action rejects invalid escrow id', async () => {
    await bootApp();
    setInputValue('#release-form [name="id"]', 'invalid');

    await submitForm('#release-form');

    expect(statusText()).toContain('Escrow ID must be a positive integer');
    expect(statusMode()).toBe('err');
  });

  it('release action submits uint escrow id', async () => {
    requestMock.mockResolvedValue({ txid: '0xrelease' });

    await bootApp();
    setFieldValue('#contract-address', CONTRACT_ADDRESS);
    setInputValue('#release-form [name="id"]', '7');

    await submitForm('#release-form');

    const [method, payload] = requestMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(method).toBe('stx_callContract');
    expect(payload.functionName).toBe('release');
    expect(payload.functionArgs).toEqual([{ type: 'uint', value: '7' }]);
    expect(statusText()).toContain('Transaction submitted: 0xrelease');
  });

  it('resolve-dispute action sends boolCV(false) when refund selected', async () => {
    requestMock.mockResolvedValue({ txid: '0xresolve' });

    await bootApp();
    setFieldValue('#contract-address', CONTRACT_ADDRESS);
    setInputValue('#resolve-form [name="id"]', '3');
    setFieldValue('#resolve-form [name="payToPayee"]', 'false');

    await submitForm('#resolve-form');

    const [, payload] = requestMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.functionName).toBe('resolve-dispute');
    expect(payload.functionArgs).toEqual([
      { type: 'uint', value: '3' },
      { type: 'bool', value: false },
    ]);
    expect(statusText()).toContain('Transaction submitted: 0xresolve');
  });

  it('extend-expiry action rejects non-integer new expiry', async () => {
    await bootApp();
    setInputValue('#extend-form [name="id"]', '3');
    setInputValue('#extend-form [name="newExpiry"]', 'not-a-number');

    await submitForm('#extend-form');

    expect(statusText()).toContain('New expiry block must be a positive integer');
    expect(statusMode()).toBe('err');
  });

  it('read form requires contract address and contract name', async () => {
    await bootApp();
    setInputValue('#read-form [name="id"]', '1');

    await submitForm('#read-form');

    expect(statusText()).toContain('Set contract address and contract name first');
    expect(statusMode()).toBe('err');
    expect(fetchCallReadOnlyFunctionMock).not.toHaveBeenCalled();
  });

  it('read form fetches escrow on testnet contract and prints JSON output', async () => {
    fetchCallReadOnlyFunctionMock.mockResolvedValue({ type: 'response-ok', value: { sample: 'escrow' } });

    await bootApp();
    setFieldValue('#contract-address', CONTRACT_ADDRESS);
    setInputValue('#read-form [name="id"]', '1');

    await submitForm('#read-form');

    expect(fetchCallReadOnlyFunctionMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchCallReadOnlyFunctionMock.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.contractAddress).toBe(CONTRACT_ADDRESS);
    expect(callArgs.contractName).toBe('stack-escrow');
    expect(callArgs.functionName).toBe('get-escrow');
    expect(callArgs.network).toBe('testnet');
    expect(callArgs.senderAddress).toBe(CONTRACT_ADDRESS);
    expect(callArgs.functionArgs).toEqual([{ type: 'uint', value: '1' }]);
    expect(statusText()).toContain('Fetched escrow data');
    expect(statusMode()).toBe('ok');
    expect(byIdOrFail<HTMLPreElement>('result').textContent).toContain('response-ok');
  });
});
