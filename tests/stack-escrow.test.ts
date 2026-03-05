import { Cl } from '@stacks/transactions';
import { describe, expect, it } from 'vitest';

const CONTRACT = 'stack-escrow';

const accounts = simnet.getAccounts();
const payer = accounts.get('wallet_1')!;
const payee = accounts.get('wallet_2')!;
const arbiter = accounts.get('wallet_3')!;
const contractPrincipal = `${simnet.deployer}.${CONTRACT}`;

function createEscrow(options?: { amount?: bigint; expiryOffset?: number; memo?: string }) {
  const amount = options?.amount ?? 10_000_000n;
  const expiryOffset = options?.expiryOffset ?? 20;
  const memo = options?.memo ?? 'milestone-1';
  const expiresAt = simnet.blockHeight + expiryOffset;

  const receipt = simnet.callPublicFn(
    CONTRACT,
    'create-escrow',
    [
      Cl.principal(payee),
      Cl.principal(arbiter),
      Cl.uint(amount),
      Cl.uint(expiresAt),
      Cl.stringAscii(memo),
    ],
    payer,
  );

  return { amount, expiresAt, memo, receipt };
}

function getEscrow(id: number | bigint) {
  const read = simnet.callReadOnlyFn(CONTRACT, 'get-escrow', [Cl.uint(id)], payer);

  expect(read.result).toBeOk(expect.anything());

  const maybeEscrow = (read.result as any).value;
  expect(maybeEscrow).toBeSome(expect.anything());

  return (maybeEscrow as any).value;
}

describe('create-escrow', () => {
  it('locks funds in contract and stores escrow data', () => {
    const { amount, expiresAt, memo, receipt } = createEscrow();

    expect(receipt.result).toBeOk(Cl.uint(1));
    expect(receipt.events.length).toBeGreaterThan(0);

    const transfer = receipt.events.find(event => event.event === 'stx_transfer_event');
    expect(transfer).toBeDefined();
    expect(transfer?.data).toMatchObject({
      amount: amount.toString(),
      sender: payer,
      recipient: contractPrincipal,
    });

    const escrow = getEscrow(1);
    expect(escrow.value.payer).toBePrincipal(payer);
    expect(escrow.value.payee).toBePrincipal(payee);
    expect(escrow.value.arbiter).toBePrincipal(arbiter);
    expect(escrow.value.amount).toBeUint(amount);
    expect(escrow.value.status).toBeUint(1);
    expect(escrow.value.memo).toBeAscii(memo);
    expect(escrow.value['expires-at']).toBeUint(expiresAt);

    expect(simnet.getDataVar(CONTRACT, 'next-escrow-id')).toBeUint(2);
  });
});

describe('release', () => {
  it('allows payer to release funds to payee', () => {
    const { amount } = createEscrow();

    const release = simnet.callPublicFn(CONTRACT, 'release', [Cl.uint(1)], payer);
    expect(release.result).toBeOk(Cl.bool(true));

    const transfer = release.events.find(event => event.event === 'stx_transfer_event');
    expect(transfer).toBeDefined();
    expect(transfer?.data).toMatchObject({
      amount: amount.toString(),
      sender: contractPrincipal,
      recipient: payee,
    });

    const escrow = getEscrow(1);
    expect(escrow.value.status).toBeUint(3);
  });

  it('rejects release from unauthorized party', () => {
    createEscrow();

    const release = simnet.callPublicFn(CONTRACT, 'release', [Cl.uint(1)], payee);
    expect(release.result).toBeErr(Cl.uint(101));
  });
});

describe('disputes', () => {
  it('allows payee to raise dispute and arbiter to refund payer', () => {
    createEscrow();

    const dispute = simnet.callPublicFn(CONTRACT, 'raise-dispute', [Cl.uint(1)], payee);
    expect(dispute.result).toBeOk(Cl.bool(true));

    const resolve = simnet.callPublicFn(
      CONTRACT,
      'resolve-dispute',
      [Cl.uint(1), Cl.bool(false)],
      arbiter,
    );
    expect(resolve.result).toBeOk(Cl.bool(true));

    const escrow = getEscrow(1);
    expect(escrow.value.status).toBeUint(4);
  });
});

describe('refund', () => {
  it('allows payer refund only after expiry', () => {
    createEscrow({ expiryOffset: 3 });

    const earlyRefund = simnet.callPublicFn(CONTRACT, 'refund', [Cl.uint(1)], payer);
    expect(earlyRefund.result).toBeErr(Cl.uint(101));

    simnet.mineEmptyBlocks(4);

    const refund = simnet.callPublicFn(CONTRACT, 'refund', [Cl.uint(1)], payer);
    expect(refund.result).toBeOk(Cl.bool(true));

    const escrow = getEscrow(1);
    expect(escrow.value.status).toBeUint(4);
  });
});

describe('extend-expiry', () => {
  it('allows payer to extend expiry and rejects invalid lower expiry', () => {
    const { expiresAt } = createEscrow({ expiryOffset: 10 });
    const newExpiry = expiresAt + 25;

    const extend = simnet.callPublicFn(
      CONTRACT,
      'extend-expiry',
      [Cl.uint(1), Cl.uint(newExpiry)],
      payer,
    );
    expect(extend.result).toBeOk(Cl.bool(true));

    const escrow = getEscrow(1);
    expect(escrow.value['expires-at']).toBeUint(newExpiry);

    const invalid = simnet.callPublicFn(
      CONTRACT,
      'extend-expiry',
      [Cl.uint(1), Cl.uint(newExpiry - 1)],
      payer,
    );
    expect(invalid.result).toBeErr(Cl.uint(104));
  });
});
