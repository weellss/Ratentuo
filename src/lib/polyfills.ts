import { Buffer } from 'buffer';

export const WALLET_ERROR_EVENT = 'ratentuo:wallet-error';

const globalRecord = globalThis as unknown as Record<string, unknown>;

if (typeof globalRecord.global === 'undefined') {
  globalRecord.global = globalThis;
}

if (typeof globalRecord.Buffer === 'undefined') {
  globalRecord.Buffer = Buffer;
}

if (typeof globalRecord.process === 'undefined') {
  globalRecord.process = { env: {} };
}

function isEmptyAccountWalletError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { code?: unknown; message?: unknown };
  const msg = typeof record.message === 'string' ? record.message.toLowerCase() : '';
  return (
    record.code === 4001 &&
    (msg.includes('at least one account') || msg.includes('no account'))
  );
}

function isWalletRejection(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { code?: unknown; name?: unknown; message?: unknown };
  if (record.code === 4001 || record.code === -32002) return true;
  if (record.name === 'UserRejectedRequestError') return true;
  const msg = typeof record.message === 'string' ? record.message.toLowerCase() : '';
  return msg.includes('at least one account');
}

export function formatWalletErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const rawMessage = String((err as { message?: unknown }).message ?? '');
    if (rawMessage.toLowerCase().includes('at least one account')) {
      return 'Your wallet extension has no active account. Create or unlock an account in your wallet and try again.';
    }
    if (rawMessage) return rawMessage.split('\n')[0];
  }
  return 'Wallet request was cancelled or pending in your extension.';
}

const guardedProviders = new WeakSet<object>();

export function guardEip1193Provider(provider: unknown): void {
  if (!provider || (typeof provider !== 'object' && typeof provider !== 'function')) return;
  const obj = provider as { request?: unknown; providers?: unknown[] };
  if (guardedProviders.has(obj)) return;
  guardedProviders.add(obj);

  if (Array.isArray(obj.providers)) {
    obj.providers.forEach(guardEip1193Provider);
  }

  const originalRequest = obj.request;
  if (typeof originalRequest !== 'function') return;

  const wrappedRequest = async function (
    this: unknown,
    args: { method?: string; params?: unknown },
  ) {
    try {
      return await (originalRequest as (a: unknown) => Promise<unknown>).call(
        this === obj ? obj : provider,
        args,
      );
    } catch (err) {
      if (args?.method === 'eth_accounts' && isEmptyAccountWalletError(err)) {
        return [];
      }
      if (isEmptyAccountWalletError(err) && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(WALLET_ERROR_EVENT, {
            detail: { message: formatWalletErrorMessage(err) },
          }),
        );
      }
      throw err;
    }
  };

  try {
    const desc = Object.getOwnPropertyDescriptor(obj, 'request');
    if (!desc || desc.writable || desc.configurable) {
      Object.defineProperty(obj, 'request', {
        value: wrappedRequest,
        writable: true,
        configurable: true,
        enumerable: desc?.enumerable ?? true,
      });
    }
  } catch {
    // Ignore non-configurable provider objects
  }
}

if (typeof window !== 'undefined') {
  const win = window as Window & { ethereum?: unknown };
  guardEip1193Provider(win.ethereum);

  window.addEventListener('ethereum#initialized', () => {
    guardEip1193Provider(win.ethereum);
  });

  window.addEventListener(
    'eip6963:announceProvider',
    (event: Event) => {
      const detail = (event as CustomEvent<{ provider?: unknown }>).detail;
      guardEip1193Provider(detail?.provider);
    },
    true,
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isWalletRejection(event.reason)) {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent(WALLET_ERROR_EVENT, {
            detail: { message: formatWalletErrorMessage(event.reason) },
          }),
        );
      }
    },
    true,
  );
}
