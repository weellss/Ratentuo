import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { getTxExplorerUrl } from '../config/contracts';
import type { TxLifecycleState } from '../hooks/useRatentuoContract';

interface TxStatusPanelProps {
  state: TxLifecycleState;
  label?: string;
  onDismiss?: () => void;
  dark?: boolean;
}

export function TxStatusPanel({ state, label, onDismiss, dark = false }: TxStatusPanelProps) {
  if (state.phase === 'idle') return null;

  const isError = state.phase === 'error';
  const isConfirmed = state.phase === 'confirmed';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl p-4 border text-sm ${
        isError
          ? dark
            ? 'bg-[#3B1622] border-[#F87171]/40 text-white'
            : 'bg-[#FFF1F2] border-[#DC2626]/30 text-[#991B1B]'
          : isConfirmed
            ? dark
              ? 'bg-[#251A40] border-[#FFD23F] text-white'
              : 'bg-[#FFFFFF] border-[#4B2E83]/40 text-[#1B1330]'
            : dark
              ? 'bg-[#251A40] border-white/15 text-white'
              : 'bg-[#F8F1FF] border-[#4B2E83]/25 text-[#1B1330]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {state.phase === 'pending' || state.phase === 'confirming' ? (
            <Loader2 className={`h-4 w-4 animate-spin ${dark ? 'text-[#FFD23F]' : 'text-[#4B2E83]'}`} />
          ) : isConfirmed ? (
            <CheckCircle2 className={`h-4 w-4 ${dark ? 'text-[#FFD23F]' : 'text-[#4B2E83]'}`} />
          ) : (
            <AlertCircle className="h-4 w-4 text-[#DC2626]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {state.phase === 'pending' && `Confirm ${label ?? 'transaction'} in your wallet`}
            {state.phase === 'confirming' && `Confirming ${label ?? 'transaction'} on Arc`}
            {state.phase === 'confirmed' && `${label ? `${label} confirmed` : 'Confirmed'} on Arc`}
            {state.phase === 'error' && 'Transaction failed'}
          </p>
          {state.error && (
            <p className={`mt-1 text-xs break-words ${dark ? 'text-[#FCA5A5]' : 'text-[#991B1B]'}`}>
              {state.error}
            </p>
          )}
          {state.hash && (
            <a
              href={getTxExplorerUrl(state.hash)}
              target="_blank"
              rel="noreferrer"
              className={`mt-2 inline-flex items-center gap-1.5 font-mono-tabular text-xs underline underline-offset-4 ${
                dark ? 'text-[#FFD23F] hover:text-[#FFE066]' : 'text-[#4B2E83] hover:text-[#1B1330]'
              }`}
            >
              <span>View on ArcScan</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {(isConfirmed || isError) && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className={`text-xs font-medium px-2 py-1 rounded-md cursor-pointer ${
              dark ? 'text-white/70 hover:text-white' : 'text-[#4B2E83] hover:bg-[#4B2E83]/10'
            }`}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
