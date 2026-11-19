import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { CONTRACT_ADDRESS, getTokenConfigByAddress } from '../config/contracts';
import {
  useAllTokensDecimalsMap,
  useMyActivity,
  useRequestsAndStats,
} from '../hooks/useRatentuoContract';
import { useNowSeconds } from '../hooks/useNowSeconds';
import { formatCountdown, formatTimestamp, formatTokenAmount, truncateAddress } from '../lib/format';
import { AuctionCard } from '../components/AuctionCard';
import { ConnectWalletPrompt } from '../components/ConnectWalletPrompt';

type ActivityTab = 'requests' | 'bids';

export function MyActivityPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<ActivityTab>('requests');

  const activityQuery = useMyActivity(isConnected ? address : undefined);
  const requestsQuery = useRequestsAndStats();
  const tokensMap = useAllTokensDecimalsMap();
  const now = useNowSeconds();

  const requestsById = useMemo(() => {
    const map = new Map<string, (typeof requestsQuery.data extends undefined ? never : NonNullable<typeof requestsQuery.data>['requests'][number])>();
    for (const req of requestsQuery.data?.requests ?? []) {
      map.set(req.id.toString(), req);
    }
    return map;
  }, [requestsQuery.data?.requests]);

  const myRequests = activityQuery.data?.myRequests ?? [];
  const myBids = activityQuery.data?.myBids ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#1B1330]">
            My activity
          </h1>
          <p className="mt-2.5 text-base text-[#4D4634]">
            Requests posted and descending bids submitted by your connected wallet.
          </p>
        </div>

        {isConnected && address && (
          <p className="font-mono-tabular text-xs font-semibold text-[#4B2E83]">
            Wallet {truncateAddress(address)}
          </p>
        )}
      </div>

      <div className="mt-8">
        {!isConnected ? (
          <ConnectWalletPrompt
            title="Connect your wallet to view activity"
            description="Your posted requests and placed bids only appear for the wallet currently connected."
          />
        ) : !CONTRACT_ADDRESS ? (
          <div className="strike-card p-8 max-w-xl">
            <h2 className="font-display text-xl font-bold text-[#1B1330]">
              Contract address not configured
            </h2>
            <p className="mt-2 text-sm text-[#4D4634]">
              Set <span className="font-mono-tabular">VITE_CONTRACT_ADDRESS</span> to load your
              on-chain activity from Arc.
            </p>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center gap-1 rounded-lg bg-[#1B1330]/5 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('requests')}
                className={`px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'requests'
                    ? 'bg-[#4B2E83] text-white'
                    : 'text-[#4D4634] hover:text-[#1B1330]'
                }`}
              >
                My Requests ({myRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bids')}
                className={`px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'bids'
                    ? 'bg-[#4B2E83] text-white'
                    : 'text-[#4D4634] hover:text-[#1B1330]'
                }`}
              >
                My Bids ({myBids.length})
              </button>
            </div>

            <div className="mt-8">
              {activityQuery.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="strike-card p-6 animate-pulse h-44" />
                  ))}
                </div>
              ) : activeTab === 'requests' ? (
                myRequests.length === 0 ? (
                  <div className="strike-card p-10 text-center max-w-xl mx-auto">
                    <h2 className="font-display text-xl font-bold text-[#1B1330]">
                      No requests posted yet
                    </h2>
                    <p className="mt-2 text-sm text-[#4D4634]">
                      Requests you create with this wallet will show here with live bid tracking
                      and settlement status.
                    </p>
                    <Link
                      to="/post"
                      className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#FFD23F] px-5 py-2.5 font-display text-sm font-semibold text-[#1B1330] border border-[#1B1330]/20 hover:bg-[#FFE066]"
                    >
                      Post a Request
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {myRequests.map((req) => {
                      const tokInfo = tokensMap.data?.[req.token.toLowerCase()] ?? {
                        decimals: 6,
                        symbol: getTokenConfigByAddress(req.token)?.fallbackSymbol ?? 'TOKEN',
                      };
                      return (
                        <AuctionCard
                          key={req.id.toString()}
                          request={req}
                          symbol={tokInfo.symbol}
                          decimals={tokInfo.decimals}
                        />
                      );
                    })}
                  </div>
                )
              ) : myBids.length === 0 ? (
                <div className="strike-card p-10 text-center max-w-xl mx-auto">
                  <h2 className="font-display text-xl font-bold text-[#1B1330]">
                    No bids placed yet
                  </h2>
                  <p className="mt-2 text-sm text-[#4D4634]">
                    Descending bids submitted from this wallet will appear here alongside their
                    current standing.
                  </p>
                  <Link
                    to="/auctions"
                    className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#4B2E83] px-5 py-2.5 font-display text-sm font-semibold text-white hover:bg-[#5C39A1]"
                  >
                    Browse Live Auctions
                  </Link>
                </div>
              ) : (
                <div className="strike-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#4B2E83]/15 bg-[#F8F1FF] text-xs font-semibold text-[#4D4634]">
                          <th className="px-5 py-3.5">Auction</th>
                          <th className="px-5 py-3.5 text-right">Your Bid</th>
                          <th className="px-5 py-3.5 text-right">Lowest Bid</th>
                          <th className="px-5 py-3.5">Standing</th>
                          <th className="px-5 py-3.5">Deadline</th>
                          <th className="px-5 py-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#4B2E83]/10 text-sm">
                        {myBids.map((bid) => {
                          const parent = requestsById.get(bid.requestId.toString());
                          const tokInfo = parent
                            ? tokensMap.data?.[parent.token.toLowerCase()] ?? {
                                decimals: 6,
                                symbol:
                                  getTokenConfigByAddress(parent.token)?.fallbackSymbol ?? 'TOKEN',
                              }
                            : { decimals: 6, symbol: 'USDC' };

                          const isLeading =
                            parent !== undefined &&
                            parent.lowestBidder.toLowerCase() === address!.toLowerCase() &&
                            parent.lowestBid === bid.amount;

                          const countdown = parent
                            ? formatCountdown(parent.deadline, now)
                            : { label: '—', ended: false, urgent: false };

                          return (
                            <tr key={bid.id} className="hover:bg-[#F8F1FF]/40">
                              <td className="px-5 py-4">
                                <span className="font-mono-tabular text-xs font-semibold text-[#4B2E83]">
                                  #{bid.requestId.toString()}
                                </span>
                                <p className="font-display font-semibold text-[#1B1330]">
                                  {parent?.title ?? `Request #${bid.requestId.toString()}`}
                                </p>
                              </td>
                              <td className="px-5 py-4 text-right font-mono-tabular font-semibold text-[#1B1330] whitespace-nowrap">
                                {formatTokenAmount(bid.amount, tokInfo.decimals)} {tokInfo.symbol}
                              </td>
                              <td className="px-5 py-4 text-right font-mono-tabular text-[#4D4634] whitespace-nowrap">
                                {parent && parent.lowestBid > 0n
                                  ? `${formatTokenAmount(parent.lowestBid, tokInfo.decimals)} ${tokInfo.symbol}`
                                  : '—'}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                {isLeading ? (
                                  <span className="inline-block rounded-full bg-[#FFD23F] px-2.5 py-0.5 font-mono-tabular text-xs font-bold text-[#1B1330]">
                                    {parent?.settled ? 'Won' : 'Leading'}
                                  </span>
                                ) : (
                                  <span className="font-mono-tabular text-xs text-[#8B84A3]">
                                    {parent?.settled ? 'Not won' : 'Outbid'}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4 font-mono-tabular text-xs text-[#4D4634] whitespace-nowrap">
                                {parent
                                  ? parent.settled
                                    ? 'Settled'
                                    : countdown.ended
                                      ? 'Ready to settle'
                                      : countdown.label
                                  : formatTimestamp(bid.timestamp)}
                              </td>
                              <td className="px-5 py-4 text-right whitespace-nowrap">
                                <Link
                                  to={`/auctions/${bid.requestId.toString()}`}
                                  className="inline-flex items-center justify-center rounded-lg bg-[#4B2E83] px-3 py-1.5 font-display text-xs font-semibold text-white hover:bg-[#5C39A1]"
                                >
                                  Open
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
