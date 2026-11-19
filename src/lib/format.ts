import { formatUnits, parseUnits } from 'viem';

export function truncateAddress(address?: string | null, startChars = 6, endChars = 4): string {
  if (!address) return '';
  if (address.length <= startChars + endChars + 3) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

export function formatTokenAmount(
  amount: bigint | undefined | null,
  decimals: number,
  maxFractionDigits = 4,
): string {
  if (amount === undefined || amount === null) return '0';
  const raw = formatUnits(amount, decimals);
  const [whole, fraction] = raw.split('.');
  const formattedWhole = Number(whole).toLocaleString('en-US');

  if (!fraction) return formattedWhole;
  const trimmed = fraction.slice(0, maxFractionDigits).replace(/0+$/, '');
  if (!trimmed) return formattedWhole;
  return `${formattedWhole}.${trimmed}`;
}

export function formatExactTokenAmount(amount: bigint | undefined | null, decimals: number): string {
  if (amount === undefined || amount === null) return '0';
  return formatUnits(amount, decimals);
}

export function parseTokenInput(value: string, decimals: number): bigint | null {
  const cleaned = value.trim().replace(/,/g, '');
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const parts = cleaned.split('.');
  if (parts[1] && parts[1].length > decimals) return null;
  try {
    const parsed = parseUnits(cleaned, decimals);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

export function formatCountdown(
  deadlineSeconds: number,
  nowSeconds: number,
): { label: string; ended: boolean; urgent: boolean } {
  const diff = deadlineSeconds - nowSeconds;
  if (diff <= 0) {
    return { label: 'Deadline passed', ended: true, urgent: false };
  }

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = Math.floor(diff % 60);

  const urgent = diff < 3600;

  if (days > 0) {
    return {
      label: `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`,
      ended: false,
      urgent,
    };
  }

  return {
    label: `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`,
    ended: false,
    urgent,
  };
}

export function formatTimestamp(timestampSeconds: number): string {
  if (!timestampSeconds) return 'Unknown';
  const date = new Date(timestampSeconds * 1000);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
