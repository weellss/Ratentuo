import { formatWalletErrorMessage, WALLET_ERROR_EVENT } from '../lib/polyfills';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { arcChain, ARC_RPC_URL } from './chain';
import { WALLETCONNECT_PROJECT_ID } from './contracts';

const baseWallets = [injectedWallet, metaMaskWallet, coinbaseWallet];

const walletGroups = WALLETCONNECT_PROJECT_ID
  ? [
      {
        groupName: 'Recommended',
        wallets: [metaMaskWallet, walletConnectWallet, coinbaseWallet, injectedWallet],
      },
    ]
  : [
      {
        groupName: 'Browser Wallets',
        wallets: baseWallets,
      },
    ];

const connectors = connectorsForWallets(walletGroups, {
  appName: 'Ratentuo',
  projectId: WALLETCONNECT_PROJECT_ID || 'ratentuo-browser-wallets',
});

export const wagmiConfig = createConfig({
  connectors,
  chains: [arcChain],
  transports: {
    [arcChain.id]: http(ARC_RPC_URL),
  },
  ssr: false,
});

function isWalletAccountError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { code?: unknown; message?: unknown };
  const msg = typeof record.message === 'string' ? record.message.toLowerCase() : '';
  return (
    record.code === 4001 &&
    (msg.includes('at least one account') || msg.includes('no account'))
  );
}

for (const connector of wagmiConfig.connectors) {
  const originalGetAccounts = connector.getAccounts?.bind(connector);
  if (originalGetAccounts) {
    connector.getAccounts = async () => {
      try {
        return await originalGetAccounts();
      } catch (err) {
        if (isWalletAccountError(err)) {
          return [];
        }
        throw err;
      }
    };
  }

  const originalOnConnect = connector.onConnect?.bind(connector);
  if (originalOnConnect) {
    connector.onConnect = async (connectInfo) => {
      try {
        await originalOnConnect(connectInfo);
      } catch (err) {
        if (isWalletAccountError(err) && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(WALLET_ERROR_EVENT, {
              detail: { message: formatWalletErrorMessage(err) },
            }),
          );
          return;
        }
        throw err;
      }
    };
  }
}
