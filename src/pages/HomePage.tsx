import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useAllTokensDecimalsMap, useContractAbi, useRequestsAndStats } from '../hooks/useRatentuoContract';
import { useNowSeconds } from '../hooks/useNowSeconds';
import { CONTRACT_ADDRESS, getTokenConfigByAddress } from '../config/contracts';
import { formatCountdown, formatTokenAmount } from '../lib/format';

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    title: 'Escrowed budget',
    body: 'A buyer describes the work, selects USDC or EURC, approves token spend, and locks the maximum budget in the contract.',
  },
  {
    number: '02',
    title: 'Descending bids',
    body: 'Sellers compete downward before the deadline. Every new bid must be strictly lower than the current lowest bid.',
  },
  {
    number: '03',
    title: 'Automatic settlement',
    body: 'Once the deadline passes, anyone can trigger settlement. The lowest bidder receives their bid and unused funds return to the buyer.',
  },
];

const ROADMAP_PHASES = [
  {
    phase: 'Phase 1',
    title: 'Core auctions live',
    status: 'Live',
    body: 'Escrowed buyer requests, descending bid enforcement, and permissionless settlement built on Arc.',
  },
  {
    phase: 'Phase 2',
    title: 'Seller ratings',
    status: 'Planned',
    body: 'On-chain completion history and verified fulfillment records tied to settled auctions.',
  },
  {
    phase: 'Phase 3',
    title: 'Milestone payments',
    status: 'Planned',
    body: 'Staged escrowed payouts released to the winning seller as agreed deliverables clear.',
  },
  {
    phase: 'Phase 4',
    title: 'Private bids',
    status: 'Planned',
    body: 'Sealed descending commitments revealed cleanly when the bidding window closes.',
  },
];

const FAQ_ITEMS = [
  {
    question: 'Who can bid',
    answer:
      'Any wallet on Arc can place a bid on an open request before its deadline, provided the bid is strictly lower than the current lowest bid and within the escrowed maximum budget.',
  },
  {
    question: 'What if nobody bids',
    answer:
      'If the deadline passes with zero bids placed, settling the request returns 100% of the escrowed maximum budget directly to the buyer.',
  },
  {
    question: 'Can the buyer reject the winner',
    answer:
      'No. Settlement follows deterministic contract rules so sellers can compete fairly. At the deadline, the lowest valid bid recorded on-chain wins automatically.',
  },
  {
    question: 'When does the winner get paid',
    answer:
      'Immediately when settlement executes after the deadline. Anyone can call settle, which sends the winning bid to the lowest bidder and refunds the remainder to the buyer in one transaction.',
  },
];

export function HomePage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const abiQuery = useContractAbi();
  const { data, isLoading, isError } = useRequestsAndStats();
  const tokensMap = useAllTokensDecimalsMap();
  const now = useNowSeconds();

  const stats = data?.stats ?? {
    totalRequests: 0,
    activeRequests: 0,
    settledRequests: 0,
    totalBids: 0,
  };

  const latestLiveRequest = data?.requests.find(
    (req) => !req.settled && !req.cancelled && req.deadline > now,
  );

  const latestTokenInfo = latestLiveRequest
    ? tokensMap.data?.[latestLiveRequest.token.toLowerCase()] ?? {
        decimals: 6,
        symbol: getTokenConfigByAddress(latestLiveRequest.token)?.fallbackSymbol ?? 'TOKEN',
      }
    : null;

  return (
    <div className="pb-20">
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 flex flex-col justify-center"
          >
            <p className="text-sm font-semibold text-[#4B2E83] tracking-tight">
              Available on Arc
            </p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl lg:text-[56px] font-bold leading-[1.08] tracking-[-0.03em] text-[#1B1330]">
              Reverse auctions built on Arc
            </h1>
            <p className="mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-[#4D4634]">
              Buyers post a need and escrow a maximum budget in USDC or EURC. Sellers place
              progressively lower bids before the deadline, and settlement pays the lowest bidder
              while returning every unused cent to the buyer.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/post"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFD23F] px-6 py-3.5 font-display text-base font-semibold text-[#1B1330] border border-[#1B1330]/20 transition-all hover:bg-[#FFE066] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(255,210,63,0.4)] whitespace-nowrap"
              >
                <span>Post a Request</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/auctions"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4B2E83] px-6 py-3.5 font-display text-base font-semibold text-white transition-all hover:bg-[#5C39A1] hover:shadow-[0_4px_12px_rgba(75,46,131,0.3)] whitespace-nowrap"
              >
                <span>Live Auctions</span>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5"
          >
            <div className="strike-board-dark h-full p-6 sm:p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <h2 className="font-display text-xl font-bold text-white">
                    Live market totals
                  </h2>
                  <span className="font-mono-tabular text-xs text-[#D4CEE6]">
                    {CONTRACT_ADDRESS ? 'On-chain' : 'Unconfigured'}
                  </span>
                </div>

                {!CONTRACT_ADDRESS ? (
                  <div className="strike-board-tile mt-5 p-5">
                    <p className="font-display text-sm font-semibold text-[#FFD23F]">
                      Contract address required
                    </p>
                    <p className="mt-1.5 text-sm text-[#D4CEE6] leading-relaxed">
                      Set <span className="font-mono-tabular text-white">VITE_CONTRACT_ADDRESS</span>{' '}
                      to load live platform statistics and active auctions directly from Arc.
                    </p>
                  </div>
                ) : abiQuery.isError ? (
                  <div className="strike-board-tile mt-5 p-5">
                    <p className="font-display text-sm font-semibold text-[#FFD23F]">
                      ABI unavailable
                    </p>
                    <p className="mt-1.5 text-sm text-[#D4CEE6] leading-relaxed">
                      {abiQuery.error instanceof Error
                        ? abiQuery.error.message
                        : 'Could not read the verified contract ABI from ArcScan.'}
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="strike-board-tile p-4">
                      <span className="block text-xs text-[#D4CEE6]">Total Requests</span>
                      <span className="mt-1.5 block font-mono-tabular text-2xl font-bold text-white">
                        {isLoading ? '—' : stats.totalRequests}
                      </span>
                    </div>
                    <div className="strike-board-tile p-4">
                      <span className="block text-xs text-[#D4CEE6]">Open Auctions</span>
                      <span className="mt-1.5 block font-mono-tabular text-2xl font-bold text-[#FFD23F]">
                        {isLoading ? '—' : stats.activeRequests}
                      </span>
                    </div>
                    <div className="strike-board-tile p-4">
                      <span className="block text-xs text-[#D4CEE6]">Settled</span>
                      <span className="mt-1.5 block font-mono-tabular text-2xl font-bold text-white">
                        {isLoading ? '—' : stats.settledRequests}
                      </span>
                    </div>
                    <div className="strike-board-tile p-4">
                      <span className="block text-xs text-[#D4CEE6]">Total Bids</span>
                      <span className="mt-1.5 block font-mono-tabular text-2xl font-bold text-white">
                        {isLoading ? '—' : stats.totalBids}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-5 border-t border-white/10">
                {isError ? (
                  <p className="text-xs text-[#FCA5A5]">
                    Unable to read live auctions from the contract RPC.
                  </p>
                ) : latestLiveRequest && latestTokenInfo ? (
                  <Link
                    to={`/auctions/${latestLiveRequest.id.toString()}`}
                    className="strike-board-tile block p-4 transition-colors hover:border-[#FFD23F]/60"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-[#D4CEE6] font-mono-tabular">
                      <span>Latest open · #{latestLiveRequest.id.toString()}</span>
                      <span className="text-[#FFD23F]">
                        {formatCountdown(latestLiveRequest.deadline, now).label}
                      </span>
                    </div>
                    <p className="mt-2 font-display text-base font-bold text-white truncate">
                      {latestLiveRequest.title}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs font-mono-tabular">
                      <span className="text-[#D4CEE6]">
                        Budget {formatTokenAmount(latestLiveRequest.maxBudget, latestTokenInfo.decimals)}{' '}
                        {latestTokenInfo.symbol}
                      </span>
                      <span className="text-[#FFD23F] font-semibold">
                        {latestLiveRequest.bidCount > 0 && latestLiveRequest.lowestBid > 0n
                          ? `Lowest ${formatTokenAmount(latestLiveRequest.lowestBid, latestTokenInfo.decimals)} ${latestTokenInfo.symbol}`
                          : 'No bids yet'}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div className="strike-board-tile p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">No live auctions yet</p>
                      <p className="mt-0.5 text-xs text-[#D4CEE6]">
                        Be the first buyer to open an escrowed request.
                      </p>
                    </div>
                    <Link
                      to="/post"
                      className="rounded-lg bg-[#FFD23F] px-3 py-2 font-display text-xs font-semibold text-[#1B1330] whitespace-nowrap shrink-0 hover:bg-[#FFE066]"
                    >
                      Post Request
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="about" className="border-t border-[#4B2E83]/12 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#1B1330]">
              How bids descend and settle
            </h2>
            <p className="mt-3 text-base text-[#4D4634] leading-relaxed">
              Every rule is enforced by the deployed contract without off-chain negotiation or manual
              escrow release.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div key={step.number} className="strike-card p-6 sm:p-7">
                <span className="font-mono-tabular text-sm font-bold text-[#4B2E83]">
                  {step.number}
                </span>
                <h3 className="mt-3 font-display text-xl font-bold text-[#1B1330]">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#4D4634]">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roadmap" className="border-t border-[#4B2E83]/12 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#1B1330]">
              Protocol roadmap
            </h2>
            <p className="mt-3 text-base text-[#4D4634] leading-relaxed">
              Staged rollout focused on deterministic settlement first and richer procurement
              primitives next.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ROADMAP_PHASES.map((item) => (
              <div key={item.phase} className="strike-card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-mono-tabular">
                    <span className="font-semibold text-[#4B2E83]">{item.phase}</span>
                    <span
                      className={
                        item.status === 'Live'
                          ? 'rounded-full bg-[#FFD23F] px-2.5 py-0.5 font-semibold text-[#1B1330]'
                          : 'text-[#8B84A3]'
                      }
                    >
                      {item.status}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold text-[#1B1330]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#4D4634]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="border-t border-[#4B2E83]/12 py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-8">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#1B1330]">
            Common questions
          </h2>

          <div className="mt-8 space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={item.question} className="strike-card overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left cursor-pointer"
                  >
                    <span className="font-display text-lg font-bold text-[#1B1330]">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 text-[#4B2E83] shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-0 text-sm leading-relaxed text-[#4D4634] border-t border-[#4B2E83]/10">
                      <p className="pt-4">{item.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
