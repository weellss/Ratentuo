import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { erc20Abi, type Address } from 'viem';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { ArrowRight, Check } from 'lucide-react';
import { ARC_CHAIN_ID } from '../config/chain';
import { CONTRACT_ADDRESS, SUPPORTED_TOKENS } from '../config/contracts';
import { useTokenMetadata } from '../hooks/useTokenMetadata';
import {
  buildCreateRequestArgs,
  useContractAbi,
  useTxLifecycle,
} from '../hooks/useRatentuoContract';
import { formatTokenAmount, parseTokenInput } from '../lib/format';
import { ConnectWalletPrompt } from '../components/ConnectWalletPrompt';
import { TxStatusPanel } from '../components/TxStatusPanel';

function defaultDeadlineValue(hoursAhead = 24): string {
  const date = new Date(Date.now() + hoursAhead * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function PostRequestPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedToken, setSelectedToken] = useState<Address>(SUPPORTED_TOKENS[0].address);
  const [budgetInput, setBudgetInput] = useState('');
  const [deadlineInput, setDeadlineInput] = useState(() => defaultDeadlineValue(24));

  const tokenMeta = useTokenMetadata(selectedToken);
  const abiQuery = useContractAbi();
  const approveTx = useTxLifecycle();
  const createTx = useTxLifecycle();

  const parsedBudget = useMemo(
    () => parseTokenInput(budgetInput, tokenMeta.decimals),
    [budgetInput, tokenMeta.decimals],
  );

  const deadlineSeconds = useMemo(() => {
    if (!deadlineInput) return 0;
    const ms = Date.parse(deadlineInput);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
  }, [deadlineInput]);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const isDeadlineValid = deadlineSeconds > nowSeconds + 60;
  const hasSufficientBalance =
    parsedBudget !== null && tokenMeta.balance !== undefined
      ? tokenMeta.balance >= parsedBudget
      : true;

  const needsApproval =
    parsedBudget !== null &&
    tokenMeta.allowance !== undefined &&
    tokenMeta.allowance < parsedBudget;

  const isWrongChain = isConnected && chainId !== ARC_CHAIN_ID;
  const createFn = abiQuery.data?.fns.createRequest;

  const canSubmit =
    Boolean(CONTRACT_ADDRESS) &&
    Boolean(abiQuery.data) &&
    Boolean(createFn) &&
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    parsedBudget !== null &&
    isDeadlineValid &&
    hasSufficientBalance &&
    !isWrongChain;

  async function handleApprove() {
    if (!CONTRACT_ADDRESS || !parsedBudget) return;
    approveTx.reset();
    createTx.reset();

    const hash = await approveTx.execute({
      address: selectedToken,
      abi: erc20Abi,
      functionName: 'approve',
      args: [CONTRACT_ADDRESS, parsedBudget],
    });

    if (hash) {
      tokenMeta.refetch();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !CONTRACT_ADDRESS || !abiQuery.data || !createFn || !parsedBudget) {
      return;
    }

    if (needsApproval) {
      await handleApprove();
      return;
    }

    createTx.reset();
    const args = buildCreateRequestArgs(createFn, {
      title: title.trim(),
      description: description.trim(),
      token: selectedToken,
      maxBudget: parsedBudget,
      deadlineSeconds,
    });

    const hash = await createTx.execute({
      address: CONTRACT_ADDRESS,
      abi: abiQuery.data.abi,
      functionName: createFn.name,
      args,
    });

    if (hash) {
      tokenMeta.refetch();
      setTitle('');
      setDescription('');
      setBudgetInput('');
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12 lg:py-16">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#1B1330]">
          Post a request
        </h1>
        <p className="mt-3 text-base text-[#4D4634] leading-relaxed">
          Escrow your maximum budget on Arc. Sellers compete downward until the deadline, and any
          unused remainder returns to your wallet upon settlement.
        </p>
      </div>

      <div className="mt-8">
        {!isConnected ? (
          <ConnectWalletPrompt
            title="Connect your wallet to post a request"
            description="Creating a reverse auction requires an ERC20 token approval and escrow deposit from your wallet."
          />
        ) : !CONTRACT_ADDRESS ? (
          <div className="strike-card p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold text-[#1B1330]">
              Contract address not configured
            </h2>
            <p className="mt-2 text-sm text-[#4D4634]">
              Configure <span className="font-mono-tabular">VITE_CONTRACT_ADDRESS</span> to enable
              creating requests on Arc.
            </p>
          </div>
        ) : isWrongChain ? (
          <div className="strike-card p-8 text-center">
            <h2 className="font-display text-xl font-bold text-[#1B1330]">
              Switch your wallet to Arc
            </h2>
            <p className="mt-2 text-sm text-[#4D4634]">
              Ratentuo escrows budgets and settles reverse auctions on Arc (Chain ID 5042002).
            </p>
            <button
              type="button"
              disabled={isSwitching}
              onClick={() => switchChain({ chainId: ARC_CHAIN_ID })}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#4B2E83] px-5 py-2.5 font-display text-sm font-semibold text-white hover:bg-[#5C39A1] disabled:opacity-50 cursor-pointer"
            >
              {isSwitching ? 'Switching network...' : 'Switch to Arc'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="strike-card p-6 sm:p-8 space-y-6">
            {abiQuery.isError && (
              <div className="rounded-xl border border-[#DC2626]/30 bg-[#FFF1F2] p-4 text-sm text-[#991B1B]">
                {abiQuery.error instanceof Error
                  ? abiQuery.error.message
                  : 'Unable to load deployed contract ABI.'}
              </div>
            )}

            <div>
              <label
                htmlFor="request-title"
                className="block text-sm font-semibold text-[#1B1330]"
              >
                Request title
              </label>
              <input
                id="request-title"
                type="text"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Smart contract security review for vault module"
                className="mt-2 w-full rounded-lg border-[1.5px] border-[#4B2E83]/20 bg-white px-4 py-3 text-sm text-[#1B1330] placeholder:text-[#8B84A3] focus:border-[#4B2E83] focus:outline-none focus:ring-3 focus:ring-[#4B2E83]/15"
              />
            </div>

            <div>
              <label
                htmlFor="request-description"
                className="block text-sm font-semibold text-[#1B1330]"
              >
                Scope and deliverables
              </label>
              <textarea
                id="request-description"
                required
                rows={4}
                maxLength={1500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe exact deliverables, acceptance requirements, and contact or submission instructions."
                className="mt-2 w-full rounded-lg border-[1.5px] border-[#4B2E83]/20 bg-white px-4 py-3 text-sm text-[#1B1330] placeholder:text-[#8B84A3] focus:border-[#4B2E83] focus:outline-none focus:ring-3 focus:ring-[#4B2E83]/15"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="block text-sm font-semibold text-[#1B1330]">Payment token</span>
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  {SUPPORTED_TOKENS.map((tok) => {
                    const active = tok.address.toLowerCase() === selectedToken.toLowerCase();
                    return (
                      <button
                        key={tok.address}
                        type="button"
                        onClick={() => {
                          setSelectedToken(tok.address);
                          approveTx.reset();
                        }}
                        className={`flex items-center justify-between rounded-lg px-4 py-3 text-left border-[1.5px] transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#4B2E83] border-[#4B2E83] text-white'
                            : 'bg-white border-[#4B2E83]/20 text-[#1B1330] hover:border-[#4B2E83]/45'
                        }`}
                      >
                        <div>
                          <span className="block font-display text-sm font-bold">
                            {tok.fallbackSymbol}
                          </span>
                          <span
                            className={`block text-xs ${
                              active ? 'text-[#D4CEE6]' : 'text-[#4D4634]'
                            }`}
                          >
                            {tok.label}
                          </span>
                        </div>
                        {active && <Check className="h-4 w-4 text-[#FFD23F]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="max-budget"
                    className="block text-sm font-semibold text-[#1B1330]"
                  >
                    Maximum budget
                  </label>
                  <span className="font-mono-tabular text-xs text-[#4D4634]">
                    Balance:{' '}
                    {tokenMeta.balance !== undefined
                      ? `${formatTokenAmount(tokenMeta.balance, tokenMeta.decimals)} ${tokenMeta.symbol}`
                      : 'Loading...'}
                  </span>
                </div>
                <div className="mt-2 relative flex items-center">
                  <span className="absolute left-3.5 font-mono-tabular text-sm font-semibold text-[#8B84A3]">
                    {tokenMeta.symbol}
                  </span>
                  <input
                    id="max-budget"
                    type="text"
                    inputMode="decimal"
                    required
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border-[1.5px] border-[#4B2E83]/20 bg-white pl-16 pr-4 py-3 font-mono-tabular text-base font-semibold text-[#1B1330] placeholder:text-[#8B84A3] focus:border-[#4B2E83] focus:outline-none focus:ring-3 focus:ring-[#4B2E83]/15"
                  />
                </div>
                {parsedBudget !== null && !hasSufficientBalance && (
                  <p className="mt-1.5 text-xs text-[#DC2626]">
                    Insufficient {tokenMeta.symbol} balance for this escrow amount.
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="auction-deadline"
                  className="block text-sm font-semibold text-[#1B1330]"
                >
                  Bidding deadline
                </label>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: '1h', hours: 1 },
                    { label: '24h', hours: 24 },
                    { label: '3d', hours: 72 },
                    { label: '7d', hours: 168 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDeadlineInput(defaultDeadlineValue(preset.hours))}
                      className="rounded-md border border-[#4B2E83]/20 px-2.5 py-1 font-mono-tabular text-xs font-medium text-[#4B2E83] hover:bg-[#4B2E83]/5 cursor-pointer"
                    >
                      +{preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="auction-deadline"
                type="datetime-local"
                required
                value={deadlineInput}
                onChange={(e) => setDeadlineInput(e.target.value)}
                className="mt-2 w-full rounded-lg border-[1.5px] border-[#4B2E83]/20 bg-white px-4 py-3 font-mono-tabular text-sm text-[#1B1330] focus:border-[#4B2E83] focus:outline-none focus:ring-3 focus:ring-[#4B2E83]/15"
              />
              {!isDeadlineValid && deadlineInput && (
                <p className="mt-1.5 text-xs text-[#DC2626]">
                  Deadline must be at least 1 minute in the future.
                </p>
              )}
            </div>

            {parsedBudget !== null && (
              <div className="rounded-xl bg-[#F8F1FF] border border-[#4B2E83]/15 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[#4D4634]">
                <span>
                  Current contract allowance:{' '}
                  <strong className="font-mono-tabular text-[#1B1330]">
                    {tokenMeta.allowance !== undefined
                      ? `${formatTokenAmount(tokenMeta.allowance, tokenMeta.decimals)} ${tokenMeta.symbol}`
                      : 'Checking...'}
                  </strong>
                </span>
                <span className="font-mono-tabular text-[#4B2E83] font-semibold">
                  {needsApproval
                    ? `Step 1 of 2: Approve ${tokenMeta.symbol}`
                    : 'Allowance ready for escrow'}
                </span>
              </div>
            )}

            <TxStatusPanel
              state={approveTx.state}
              label={`${tokenMeta.symbol} approval`}
              onDismiss={approveTx.reset}
            />

            <TxStatusPanel
              state={createTx.state}
              label="Request creation"
              onDismiss={createTx.reset}
            />

            {createTx.state.phase === 'confirmed' && (
              <div className="flex justify-end">
                <Link
                  to="/auctions"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#4B2E83] px-4 py-2.5 font-display text-sm font-semibold text-white hover:bg-[#5C39A1]"
                >
                  <span>View in Live Auctions</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
              {needsApproval ? (
                <button
                  type="button"
                  disabled={
                    !canSubmit ||
                    approveTx.state.phase === 'pending' ||
                    approveTx.state.phase === 'confirming'
                  }
                  onClick={handleApprove}
                  className="inline-flex items-center justify-center rounded-xl bg-[#FFD23F] px-6 py-3 font-display text-sm font-semibold text-[#1B1330] border border-[#1B1330]/20 transition-all hover:bg-[#FFE066] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {approveTx.state.phase === 'pending' || approveTx.state.phase === 'confirming'
                    ? `Approving ${tokenMeta.symbol}...`
                    : `Approve ${tokenMeta.symbol}`}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={
                    !canSubmit ||
                    createTx.state.phase === 'pending' ||
                    createTx.state.phase === 'confirming'
                  }
                  className="inline-flex items-center justify-center rounded-xl bg-[#FFD23F] px-6 py-3 font-display text-sm font-semibold text-[#1B1330] border border-[#1B1330]/20 transition-all hover:bg-[#FFE066] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {createTx.state.phase === 'pending' || createTx.state.phase === 'confirming'
                    ? 'Posting request...'
                    : 'Post Request'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
