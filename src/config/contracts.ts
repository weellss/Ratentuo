import { isAddress, type Address } from 'viem';
import { ARC_EXPLORER_URL } from './chain';

const RAW_CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ?? '').trim();
const RAW_WALLETCONNECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '').trim();
const RAW_ADMIN_WALLET = (import.meta.env.VITE_ADMIN_WALLET ?? '').trim();

export const CONTRACT_ADDRESS: Address | null = isAddress(RAW_CONTRACT_ADDRESS)
  ? (RAW_CONTRACT_ADDRESS as Address)
  : null;

export const WALLETCONNECT_PROJECT_ID: string =
  RAW_WALLETCONNECT_ID && !RAW_WALLETCONNECT_ID.startsWith('[')
    ? RAW_WALLETCONNECT_ID
    : '';

export const ADMIN_WALLET: Address | null = isAddress(RAW_ADMIN_WALLET)
  ? (RAW_ADMIN_WALLET as Address)
  : null;

export interface SupportedTokenConfig {
  id: 'USDC' | 'EURC';
  fallbackSymbol: string;
  label: string;
  address: Address;
}

export const SUPPORTED_TOKENS: SupportedTokenConfig[] = [
  {
    id: 'USDC',
    fallbackSymbol: 'USDC',
    label: 'USD Coin',
    address: '0x3600000000000000000000000000000000000000',
  },
  {
    id: 'EURC',
    fallbackSymbol: 'EURC',
    label: 'Euro Coin',
    address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
  },
];

export function getTokenConfigByAddress(address?: string | null): SupportedTokenConfig | undefined {
  if (!address) return undefined;
  const normalized = address.toLowerCase();
  return SUPPORTED_TOKENS.find((token) => token.address.toLowerCase() === normalized);
}

export function getTxExplorerUrl(hash: string): string {
  return `${ARC_EXPLORER_URL}/tx/${hash}`;
}

export function getAddressExplorerUrl(address: string): string {
  return `${ARC_EXPLORER_URL}/address/${address}`;
}
