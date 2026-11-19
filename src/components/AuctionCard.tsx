import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { NormalizedRequest } from '../lib/abiLoader';
import { formatCountdown, formatTokenAmount, truncateAddress } from '../lib/format';
import { useNowSeconds } from '../hooks/useNowSeconds';

interface AuctionCardProps {
  request: NormalizedRequest;
  symbol: string;
  decimals: number;
}

export function AuctionCard({ request, symbol, decimals }: AuctionCardProps) {
  const now = useNowSeconds();
  const countdown = formatCountdown(request.deadline, now);

  const statusLabel = request.settled
    ? 'Settled'
    : request.cancelled
      ? 'Cancelled'
      : countdown.ended
        ? 'Ready to settle'
        : 'Open';

  const hasBids = request.bidCount > 0 && request.lowestBid > 0n;

  return (
    <Link
      to={`/auctions/${request.id.toString()}`}
      className="strike-card strike-card-interactive block p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B2E83]"
    >
      <div className="flex items-center justify-between gap-3 text-xs text-[#4D4634]">
        <div className="flex items-center gap-2 font-mono-tabular">
          <span className="font-semibold text-[#4B2E83]">#{request.id.toString()}</span>
          <span aria-hidden="true">·</span>
          <span>{symbol}</span>
          <span aria-hidden="true">·</span>
          <span className="font-sans font-semibold text-[#1B1330]">{statusLabel}</span>
        </div>
        <ArrowUpRight className="h-4 w-4 text-[#4B2E83] shrink-0" />
      </div>

      <h3 className="mt-3 font-display text-xl font-bold text-[#1B1330] line-clamp-2">
        {request.title}
      </h3>

      {request.description && (
        <p className="mt-2 text-sm text-[#4D4634] line-clamp-2 leading-relaxed">
          {request.description}
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-[#4B2E83]/10 grid grid-cols-2 gap-4">
        <div>
          <span className="block text-xs font-medium text-[#4D4634]">Max Budget</span>
          <span className="mt-1 block font-mono-tabular text-base font-semibold text-[#1B1330]">
            {formatTokenAmount(request.maxBudget, decimals)} {symbol}
          </span>
        </div>

        <div>
          <span className="block text-xs font-medium text-[#4D4634]">
            {request.settled ? 'Winning Bid' : 'Lowest Bid'}
          </span>
          {hasBids ? (
            <span className="mt-1 inline-block rounded-full bg-[#FFD23F] px-2.5 py-0.5 font-mono-tabular text-sm font-bold text-[#1B1330]">
              {formatTokenAmount(request.lowestBid, decimals)} {symbol}
            </span>
          ) : (
            <span className="mt-1 block text-sm font-medium text-[#8B84A3]">
              No bids yet
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#4B2E83]/10 flex items-center justify-between gap-2 text-xs text-[#4D4634]">
        <span className="font-mono-tabular">
          {request.bidCount} {request.bidCount === 1 ? 'bid' : 'bids'} · Buyer {truncateAddress(request.buyer)}
        </span>
        <span className="font-mono-tabular font-medium text-[#1B1330]">
          {request.settled ? 'Finalized' : countdown.label}
        </span>
      </div>
    </Link>
  );
}
