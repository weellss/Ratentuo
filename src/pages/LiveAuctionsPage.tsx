import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { CONTRACT_ADDRESS, SUPPORTED_TOKENS, getTokenConfigByAddress } from '../config/contracts';
import { useAllTokensDecimalsMap, useContractAbi, useRequestsAndStats } from '../hooks/useRatentuoContract';
import { useNowSeconds } from '../hooks/useNowSeconds';
import { AuctionCard } from '../components/AuctionCard';

type StatusFilter = 'all' | 'open' | 'ready' | 'settled';
type TokenFilter = 'all' | 'USDC' | 'EURC';

export function LiveAuctionsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tokenFilter, setTokenFilter] = useState<TokenFilter>('all');
  const [query, setQuery] = useState('');

  const abiQuery = useContractAbi();
  const { data, isLoading, isError, refetch } = useRequestsAndStats();
  const tokensMap = useAllTokensDecimalsMap();
  const now = useNowSeconds();

  const filteredRequests = useMemo(() => {
    const list = data?.requests ?? [];
    const normalizedQuery = query.trim().toLowerCase();

    return list.filter((req) => {
      const ended = req.deadline <= now;
      if (statusFilter === 'open' && (req.settled || req.cancelled || ended)) return false;
      if (statusFilter === 'ready' && (req.settled || req.cancelled || !ended)) return false;
      if (statusFilter === 'settled' && !req.settled) return false;

      if (tokenFilter !== 'all') {
        const targetToken = SUPPORTED_TOKENS.find((t) => t.id === tokenFilter);
        if (targetToken && req.token.toLowerCase() !== targetToken.address.toLowerCase()) {
          return false;
        }
      }

      if (normalizedQuery) {
        const matchesTitle = req.title.toLowerCase().includes(normalizedQuery);
        const matchesDesc = req.description.toLowerCase().includes(normalizedQuery);
        const matchesId = req.id.toString().includes(normalizedQuery);
        const matchesBuyer = req.buyer.toLowerCase().includes(normalizedQuery);
        if (!matchesTitle && !matchesDesc && !matchesId && !matchesBuyer) return false;
      }

      return true;
    });
  }, [data?.requests, now, query, statusFilter, tokenFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#1B1330]">
            Live auctions
          </h1>
          <p className="mt-2.5 text-base text-[#4D4634]">
            Browse active and completed reverse auctions read directly from Arc.
          </p>
        </div>

        <Link
          to="/post"
          className="inline-flex items-center justify-center rounded-xl bg-[#FFD23F] px-5 py-2.5 font-display text-sm font-semibold text-[#1B1330] border border-[#1B1330]/20 hover:bg-[#FFE066] whitespace-nowrap self-start md:self-auto"
        >
          Post a Request
        </Link>
      </div>

      <div className="mt-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-lg bg-[#1B1330]/5 p-1">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'open', label: 'Open' },
                { id: 'ready', label: 'Ready to settle' },
                { id: 'settled', label: 'Settled' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-[#4B2E83] text-white'
                    : 'text-[#4D4634] hover:text-[#1B1330]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1 rounded-lg bg-[#1B1330]/5 p-1">
            {(['all', 'USDC', 'EURC'] as const).map((tok) => (
              <button
                key={tok}
                type="button"
                onClick={() => setTokenFilter(tok)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  tokenFilter === tok
                    ? 'bg-[#1B1330] text-white'
                    : 'text-[#4D4634] hover:text-[#1B1330]'
                }`}
              >
                {tok === 'all' ? 'All tokens' : tok}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="h-4 w-4 text-[#8B84A3] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, ID, or buyer"
            aria-label="Search auctions"
            className="w-full rounded-lg border-[1.5px] border-[#4B2E83]/20 bg-white pl-10 pr-4 py-2 text-sm text-[#1B1330] placeholder:text-[#8B84A3] focus:border-[#4B2E83] focus:outline-none focus:ring-3 focus:ring-[#4B2E83]/15"
          />
        </div>
      </div>

      <div className="mt-8">
        {!CONTRACT_ADDRESS ? (
          <div className="strike-card p-10 text-center max-w-xl mx-auto">
            <h2 className="font-display text-xl font-bold text-[#1B1330]">
              Contract address not configured
            </h2>
            <p className="mt-2 text-sm text-[#4D4634]">
              Set <span className="font-mono-tabular">VITE_CONTRACT_ADDRESS</span> to load live
              auctions from Arc.
            </p>
          </div>
        ) : abiQuery.isError ? (
          <div className="strike-card p-10 text-center max-w-xl mx-auto">
            <h2 className="font-display text-xl font-bold text-[#1B1330]">
              Unable to load contract ABI
            </h2>
            <p className="mt-2 text-sm text-[#4D4634]">
              {abiQuery.error instanceof Error
                ? abiQuery.error.message
                : 'Could not retrieve verified ABI from ArcScan.'}
            </p>
          </div>
        ) : isLoading || abiQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="strike-card p-6 animate-pulse space-y-4">
                <div className="h-3 w-28 rounded bg-[#4B2E83]/10" />
                <div className="h-6 w-3/4 rounded bg-[#4B2E83]/15" />
                <div className="h-4 w-full rounded bg-[#4B2E83]/10" />
                <div className="pt-4 border-t border-[#4B2E83]/10 grid grid-cols-2 gap-4">
                  <div className="h-8 rounded bg-[#4B2E83]/10" />
                  <div className="h-8 rounded bg-[#4B2E83]/10" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="strike-card p-10 text-center max-w-xl mx-auto">
            <h2 className="font-display text-xl font-bold text-[#1B1330]">
              Failed to read auctions
            </h2>
            <p className="mt-2 text-sm text-[#4D4634]">
              There was a problem querying the Arc RPC endpoint.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-5 rounded-lg bg-[#4B2E83] px-4 py-2 font-display text-sm font-semibold text-white hover:bg-[#5C39A1] cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="strike-card p-10 text-center max-w-xl mx-auto">
            <h2 className="font-display text-xl font-bold text-[#1B1330]">
              {(data?.requests.length ?? 0) === 0
                ? 'No auctions on-chain yet'
                : 'No auctions match your filters'}
            </h2>
            <p className="mt-2 text-sm text-[#4D4634]">
              {(data?.requests.length ?? 0) === 0
                ? 'Once a buyer creates a request and escrows a budget, it will appear here.'
                : 'Try clearing your search term or switching status and token filters.'}
            </p>
            {(data?.requests.length ?? 0) === 0 && (
              <Link
                to="/post"
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#FFD23F] px-5 py-2.5 font-display text-sm font-semibold text-[#1B1330] border border-[#1B1330]/20 hover:bg-[#FFE066]"
              >
                Post First Request
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRequests.map((req) => {
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
        )}
      </div>
    </div>
  );
}
