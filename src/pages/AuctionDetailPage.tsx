import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { zeroAddress } from 'viem';
import { ARC_CHAIN_ID } from '../config/chain';
import { CONTRACT_ADDRESS, getAddressExplorerUrl } from '../config/contracts';
import {
  buildPlaceBidArgs,
  buildSettleArgs,
  useContractAbi,
  useRequestDetail,
  useTxLifecycle,
} from '../hooks/useRatentuoContract';
import { useTokenMetadata } from '../hooks/useTokenMetadata';
import { useNowSeconds } from '../hooks/useNowSeconds';
import {
  formatCountdown,
  formatTimestamp,
  formatTokenAmount,
  parseTokenInput,
  truncateAddress,
} from '../lib/format';
import { ConnectWalletPrompt } from '../components/ConnectWalletPrompt';
import { TxStatusPanel } from '../components/TxStatusPanel';

export function AuctionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const abiQuery = useContractAbi();
  const detailQuery = useRequestDetail(id);
  const request = detailQuery.data?.request ?? null;
  const bids = detailQuery.data?.bids ?? [];

  const tokenMeta = useTokenMetadata(request?.token);
  const now = useNowSeconds();

  const [bidInput, setBidInput] = useState('');
  const bidTx = useTxLifecycle();
  const settleTx = useTxLifecycle();

  const sortedBids = useMemo(() => {
    return [...bids].sort((a, b) => {
      if (a.amount < b.amount) return -1;
      if (a.amount > b.amount) return 1;
      return b.timestamp - a.timestamp;
    });
  }, [bids]);

  const effectiveLowestBid = useMemo(() => {
    if (request && request.lowestBid > 0n) return request.lowestBid;
    if (sortedBids.length > 0) return sortedBids[0].amount;
    return 0n;
  }, [request, sortedBids]);

  const effectiveLowestBidder = useMemo(() => {
    if (request && request.lowestBidder !== zeroAddress) return request.lowestBidder;
    if (sortedBids.length > 0) return sortedBids[0].bidder;
    return zeroAddress;
  }, [request, sortedBids]);

  const hasBids = effectiveLowestBid > 0n && effectiveLowestBidder !== zeroAddress;
  const countdown = request
    ? formatCountdown(request.deadline, now)
    : { label: '—', ended: false, urgent: false };

  const isOpen = Boolean(request && !request.settled && !request.cancelled && !countdown.ended);
  const isReadyToSettle = Boolean(
    request && !request.settled && !request.cancelled && countdown.ended,
  );
  const isWrongChain = isConnected && chainId !== ARC_CHAIN_ID;

  const parsedBid = useMemo(
    () => parseTokenInput(bidInput, tokenMeta.decimals),
    [bidInput, tokenMeta.decimals],
  );

  const bidValidationError = useMemo(() => {
    if (!bidInput.trim()) return null;
    if (parsedBid === null) return `Enter a valid ${tokenMeta.symbol} amount.`;
    if (!request) return null;
    if (hasBids && parsedBid >= effectiveLowestBid) {
      return `Bid must be strictly lower than ${formatTokenAmount(
        effectiveLowestBid,
        tokenMeta.decimals,
      )} ${tokenMeta.symbol}.`;
    }
    if (!hasBids && parsedBid > request.maxBudget) {
      return `Initial bid cannot exceed max budget (${formatTokenAmount(
        request.maxBudget,
        tokenMeta.decimals,
      )} ${tokenMeta.symbol}).`;
    }
    return null;
  }, [
    bidInput,
    effectiveLowestBid,
    hasBids,
    parsedBid,
    request,
    tokenMeta.decimals,
    tokenMeta.symbol,
  ]);

  const isBuyer =
    Boolean(address && request) &&
    address!.toLowerCase() === request!.buyer.toLowerCase();

  const canPlaceBid =
    Boolean(CONTRACT_ADDRESS && abiQuery.data?.fns.placeBid && request) &&
    isConnected &&
    !isWrongChain &&
    isOpen &&
    parsedBid !== null &&
    !bidValidationError;

  const canSettle =
    Boolean(CONTRACT_ADDRESS && abiQuery.data?.fns.settle && request) &&
    isConnected &&
    !isWrongChain &&
    isReadyToSettle;

  async function handlePlaceBid(e: FormEvent) {
    e.preventDefault();
    if (!canPlaceBid || !CONTRACT_ADDRESS || !abiQuery.data?.fns.placeBid || !request || !parsedBid) {
      return;
    }

    bidTx.reset();
    const args = buildPlaceBidArgs(abiQuery.data.fns.placeBid, request.id, parsedBid);
    const hash = await bidTx.execute({
      address: CONTRACT_ADDRESS,
      abi: abiQuery.data.abi,
      functionName: abiQuery.data.fns.placeBid.name,
      args,
    });

    if (hash) {
      setBidInput('');
      detailQuery.refetch();
    }
  }

  async function handleSettle() {
    if (!canSettle || !CONTRACT_ADDRESS || !abiQuery.data?.fns.settle || !request) {
      return;
    }

    settleTx.reset();
    const args = buildSettleArgs(abiQuery.data.fns.settle, request.id);
    const hash = await settleTx.execute({
      address: CONTRACT_ADDRESS,
      abi: abiQuery.data.abi,
      functionName: abiQuery.data.fns.settle.name,
      args,
    });

    if (hash) {
      detailQuery.refetch();
    }
  }

  const remainderAmount =
    request && hasBids && request.maxBudget >= effectiveLowestBid
      ? request.maxBudget - effectiveLowestBid
      : request?.maxBudget ?? 0n;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 lg:py-14">
      <Link
        to="/auctions"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#4B2E83] hover:text-[#1B1330]"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Live Auctions</span>
      </Link>

      {!CONTRACT_ADDRESS ? (
        <div className="mt-8 strike-card p-8 max-w-xl">
          <h1 className="font-display text-2xl font-bold text-[#1B1330]">
            Contract address not configured
          </h1>
          <p className="mt-2 text-sm text-[#4D4634]">
            Set <span className="font-mono-tabular">VITE_CONTRACT_ADDRESS</span> to inspect on-chain
            auctions.
          </p>
        </div>
      ) : detailQuery.isLoading || abiQuery.isLoading ? (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 strike-card p-8 animate-pulse space-y-4">
            <div className="h-4 w-36 bg-[#4B2E83]/10 rounded" />
            <div className="h-9 w-2/3 bg-[#4B2E83]/15 rounded" />
            <div className="h-24 w-full bg-[#4B2E83]/10 rounded" />
          </div>
          <div className="lg:col-span-4 strike-board-dark p-6 animate-pulse h-80" />
        </div>
      ) : !request ? (
        <div className="mt-8 strike-card p-10 text-center max-w-xl mx-auto">
          <h1 className="font-display text-2xl font-bold text-[#1B1330]">
            Auction not found
          </h1>
          <p className="mt-2 text-sm text-[#4D4634]">
            Request #{id} does not exist on the deployed contract.
          </p>
          <Link
            to="/auctions"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#4B2E83] px-5 py-2.5 font-display text-sm font-semibold text-white hover:bg-[#5C39A1]"
          >
            Browse Live Auctions
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-6">
            <div className="strike-card p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-[#4D4634]">
                <span className="font-semibold text-[#4B2E83]">#{request.id.toString()}</span>
                <span aria-hidden="true">·</span>
                <span>{tokenMeta.symbol}</span>
                <span aria-hidden="true">·</span>
                <span className="font-sans font-semibold text-[#1B1330]">
                  {request.settled
                    ? 'Settled'
                    : request.cancelled
                      ? 'Cancelled'
                      : countdown.ended
                        ? 'Ready to settle'
                        : 'Open'}
                </span>
                <span aria-hidden="true">·</span>
                <a
                  href={getAddressExplorerUrl(request.buyer)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#4B2E83] hover:underline"
                >
                  <span>Buyer {truncateAddress(request.buyer)}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <h1 className="mt-3 font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#1B1330]">
                {request.title.replace(/[.,!?;:]+$/g, '')}
              </h1>

              {request.description && (
                <p className="mt-4 text-base leading-relaxed text-[#4D4634] whitespace-pre-line">
                  {request.description}
                </p>
              )}

              <div className="mt-6 pt-6 border-t border-[#4B2E83]/10 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="block text-xs font-medium text-[#4D4634]">Escrowed Budget</span>
                  <span className="mt-1 block font-mono-tabular text-lg font-bold text-[#1B1330]">
                    {formatTokenAmount(request.maxBudget, tokenMeta.decimals)} {tokenMeta.symbol}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-[#4D4634]">Deadline</span>
                  <span className="mt-1 block font-mono-tabular text-sm font-semibold text-[#1B1330]">
                    {formatTimestamp(request.deadline)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-[#4D4634]">Time Remaining</span>
                  <span className="mt-1 block font-mono-tabular text-sm font-semibold text-[#4B2E83]">
                    {request.settled ? 'Finalized' : countdown.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="strike-card p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-display text-2xl font-bold text-[#1B1330]">
                  Bid ledger
                </h2>
                <span className="font-mono-tabular text-xs font-semibold text-[#4D4634]">
                  {sortedBids.length} {sortedBids.length === 1 ? 'bid' : 'bids'}
                </span>
              </div>

              {sortedBids.length === 0 ? (
                <div className="mt-6 rounded-xl border border-[#4B2E83]/12 bg-[#FBF8F1] p-8 text-center">
                  <p className="font-display text-base font-semibold text-[#1B1330]">
                    No bids placed yet
                  </p>
                  <p className="mt-1 text-sm text-[#4D4634]">
                    The first seller can submit any amount up to{' '}
                    <span className="font-mono-tabular font-semibold text-[#1B1330]">
                      {formatTokenAmount(request.maxBudget, tokenMeta.decimals)} {tokenMeta.symbol}
                    </span>
                    .
                  </p>
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#4B2E83]/15 text-xs font-semibold text-[#4D4634]">
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4">Seller</th>
                        <th className="py-3 pr-4 text-right">Bid Amount</th>
                        <th className="py-3 pr-4 text-right">Savings</th>
                        <th className="py-3 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#4B2E83]/10 text-sm">
                      {sortedBids.map((bid, idx) => {
                        const isLowest = idx === 0;
                        const savings =
                          request.maxBudget >= bid.amount ? request.maxBudget - bid.amount : 0n;
                        const isMine =
                          address && bid.bidder.toLowerCase() === address.toLowerCase();

                        return (
                          <tr key={bid.id} className="hover:bg-[#F8F1FF]/50">
                            <td className="py-3.5 pr-4 whitespace-nowrap">
                              {isLowest ? (
                                <span className="inline-block rounded-full bg-[#FFD23F] px-2.5 py-0.5 font-mono-tabular text-xs font-bold text-[#1B1330]">
                                  {request.settled ? 'Winner' : 'Lowest'}
                                </span>
                              ) : (
                                <span className="font-mono-tabular text-xs text-[#8B84A3]">
                                  Outbid
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 pr-4 font-mono-tabular whitespace-nowrap">
                              <a
                                href={getAddressExplorerUrl(bid.bidder)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#1B1330] hover:text-[#4B2E83] hover:underline"
                              >
                                {truncateAddress(bid.bidder)}
                              </a>
                              {isMine && (
                                <span className="ml-2 font-sans text-xs font-semibold text-[#4B2E83]">
                                  (You)
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 pr-4 text-right font-mono-tabular font-semibold text-[#1B1330] whitespace-nowrap">
                              {formatTokenAmount(bid.amount, tokenMeta.decimals)} {tokenMeta.symbol}
                            </td>
                            <td className="py-3.5 pr-4 text-right font-mono-tabular text-[#4B2E83] whitespace-nowrap">
                              {formatTokenAmount(savings, tokenMeta.decimals)} {tokenMeta.symbol}
                            </td>
                            <td className="py-3.5 text-right font-mono-tabular text-xs text-[#4D4634] whitespace-nowrap">
                              {bid.timestamp ? formatTimestamp(bid.timestamp) : 'On-chain'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <div className="strike-board-dark p-6 space-y-5">
              <div className="border-b border-white/10 pb-4">
                <span className="text-xs font-medium text-[#D4CEE6]">
                  {request.settled
                    ? 'Winning Bid'
                    : hasBids
                      ? 'Current Lowest Bid'
                      : 'Maximum Budget Ceiling'}
                </span>
                <div className="mt-1.5 font-mono-tabular text-2xl sm:text-3xl font-bold text-[#FFD23F]">
                  {hasBids
                    ? `${formatTokenAmount(effectiveLowestBid, tokenMeta.decimals)} ${tokenMeta.symbol}`
                    : `${formatTokenAmount(request.maxBudget, tokenMeta.decimals)} ${tokenMeta.symbol}`}
                </div>
                {hasBids && (
                  <p className="mt-1 font-mono-tabular text-xs text-[#D4CEE6]">
                    Leader: {truncateAddress(effectiveLowestBidder)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="strike-board-tile p-3.5">
                  <span className="block text-xs text-[#D4CEE6]">Bids</span>
                  <span className="mt-1 block font-mono-tabular text-lg font-bold text-white">
                    {sortedBids.length || request.bidCount}
                  </span>
                </div>
                <div className="strike-board-tile p-3.5">
                  <span className="block text-xs text-[#D4CEE6]">Refund Pool</span>
                  <span className="mt-1 block font-mono-tabular text-lg font-bold text-white">
                    {formatTokenAmount(remainderAmount, tokenMeta.decimals)} {tokenMeta.symbol}
                  </span>
                </div>
              </div>

              {!isConnected ? (
                <ConnectWalletPrompt
                  dark
                  title="Connect wallet to participate"
                  description="Connect your wallet on Arc to place a lower bid or trigger settlement."
                />
              ) : isWrongChain ? (
                <div className="strike-board-tile p-5 text-center">
                  <p className="text-sm text-[#D4CEE6]">
                    Switch your wallet to Arc to submit bids or settle this auction.
                  </p>
                  <button
                    type="button"
                    disabled={isSwitching}
                    onClick={() => switchChain({ chainId: ARC_CHAIN_ID })}
                    className="mt-4 w-full rounded-lg bg-[#FFD23F] px-4 py-2.5 font-display text-sm font-semibold text-[#1B1330] hover:bg-[#FFE066] cursor-pointer"
                  >
                    {isSwitching ? 'Switching...' : 'Switch to Arc'}
                  </button>
                </div>
              ) : request.settled ? (
                <div className="strike-board-tile p-5 space-y-3">
                  <p className="font-display text-base font-bold text-[#FFD23F]">
                    Auction settled
                  </p>
                  {hasBids ? (
                    <div className="space-y-2 text-xs text-[#D4CEE6]">
                      <div className="flex justify-between gap-2">
                        <span>Winner paid</span>
                        <span className="font-mono-tabular text-white font-semibold">
                          {formatTokenAmount(effectiveLowestBid, tokenMeta.decimals)}{' '}
                          {tokenMeta.symbol}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>Returned to buyer</span>
                        <span className="font-mono-tabular text-white font-semibold">
                          {formatTokenAmount(remainderAmount, tokenMeta.decimals)}{' '}
                          {tokenMeta.symbol}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#D4CEE6]">
                      No bids were placed before the deadline. The full escrowed budget returned to
                      the buyer.
                    </p>
                  )}
                </div>
              ) : isReadyToSettle ? (
                <div className="space-y-4">
                  <div className="strike-board-tile p-4 text-xs text-[#D4CEE6] leading-relaxed">
                    {hasBids ? (
                      <>
                        The deadline has passed. Anyone can settle this request now to pay{' '}
                        <strong className="font-mono-tabular text-white">
                          {formatTokenAmount(effectiveLowestBid, tokenMeta.decimals)}{' '}
                          {tokenMeta.symbol}
                        </strong>{' '}
                        to {truncateAddress(effectiveLowestBidder)} and refund{' '}
                        <strong className="font-mono-tabular text-white">
                          {formatTokenAmount(remainderAmount, tokenMeta.decimals)}{' '}
                          {tokenMeta.symbol}
                        </strong>{' '}
                        to the buyer.
                      </>
                    ) : (
                      <>
                        The deadline passed with zero bids. Settling returns{' '}
                        <strong className="font-mono-tabular text-white">
                          {formatTokenAmount(request.maxBudget, tokenMeta.decimals)}{' '}
                          {tokenMeta.symbol}
                        </strong>{' '}
                        to the buyer.
                      </>
                    )}
                  </div>

                  <TxStatusPanel
                    dark
                    state={settleTx.state}
                    label="Settlement"
                    onDismiss={settleTx.reset}
                  />

                  <button
                    type="button"
                    disabled={
                      !canSettle ||
                      settleTx.state.phase === 'pending' ||
                      settleTx.state.phase === 'confirming'
                    }
                    onClick={handleSettle}
                    className="w-full rounded-xl bg-[#FFD23F] px-5 py-3 font-display text-sm font-semibold text-[#1B1330] border border-[#1B1330]/20 hover:bg-[#FFE066] disabled:opacity-50 cursor-pointer"
                  >
                    {settleTx.state.phase === 'pending' || settleTx.state.phase === 'confirming'
                      ? 'Settling auction...'
                      : 'Settle Auction'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePlaceBid} className="space-y-4">
                  <div>
                    <label htmlFor="bid-amount" className="block text-xs font-semibold text-white">
                      Your descending bid
                    </label>
                    <p className="mt-1 text-xs text-[#D4CEE6]">
                      {hasBids
                        ? `Enter strictly less than ${formatTokenAmount(
                            effectiveLowestBid,
                            tokenMeta.decimals,
                          )} ${tokenMeta.symbol}`
                        : `Enter up to ${formatTokenAmount(
                            request.maxBudget,
                            tokenMeta.decimals,
                          )} ${tokenMeta.symbol}`}
                    </p>
                    <div className="mt-2.5 relative flex items-center">
                      <span className="absolute left-3.5 font-mono-tabular text-sm font-semibold text-[#8B84A3]">
                        {tokenMeta.symbol}
                      </span>
                      <input
                        id="bid-amount"
                        type="text"
                        inputMode="decimal"
                        required
                        value={bidInput}
                        onChange={(e) => setBidInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border-[1.5px] border-[#4B2E83] bg-[#FFFFFF] pl-16 pr-4 py-3 font-mono-tabular text-base font-semibold text-[#1B1330] placeholder:text-[#8B84A3] focus:outline-none focus:ring-3 focus:ring-[#FFD23F]/40"
                      />
                    </div>
                    {bidValidationError && (
                      <p className="mt-1.5 text-xs text-[#FCA5A5]">{bidValidationError}</p>
                    )}
                    {isBuyer && (
                      <p className="mt-1.5 text-xs text-[#D4CEE6]">
                        Note: This wallet created the request.
                      </p>
                    )}
                  </div>

                  <TxStatusPanel
                    dark
                    state={bidTx.state}
                    label="Bid submission"
                    onDismiss={bidTx.reset}
                  />

                  <button
                    type="submit"
                    disabled={
                      !canPlaceBid ||
                      bidTx.state.phase === 'pending' ||
                      bidTx.state.phase === 'confirming'
                    }
                    className="w-full rounded-xl bg-[#FFD23F] px-5 py-3 font-display text-sm font-semibold text-[#1B1330] border border-[#1B1330]/20 hover:bg-[#FFE066] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {bidTx.state.phase === 'pending' || bidTx.state.phase === 'confirming'
                      ? 'Submitting bid...'
                      : 'Place Bid'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
