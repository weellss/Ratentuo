import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { erc20Abi, type Address, type Hash } from 'viem';
import { usePublicClient, useWriteContract } from 'wagmi';
import { CONTRACT_ADDRESS, SUPPORTED_TOKENS } from '../config/contracts';
import {
  buildCreateRequestArgs,
  buildPlaceBidArgs,
  buildSettleArgs,
  fetchDeployedContractAbi,
  normalizeBid,
  normalizeRequest,
  normalizeStats,
  resolveContractFunctions,
  type FetchedAbiResult,
  type NormalizedBid,
  type NormalizedPlatformStats,
  type NormalizedRequest,
  type ResolvedContractFunctions,
} from '../lib/abiLoader';

export type TxPhase = 'idle' | 'pending' | 'confirming' | 'confirmed' | 'error';

export interface TxLifecycleState {
  phase: TxPhase;
  hash?: Hash;
  error?: string;
}

export function useContractAbi() {
  return useQuery<FetchedAbiResult & { fns: ResolvedContractFunctions }>({
    queryKey: ['ratentuo-contract-abi', CONTRACT_ADDRESS],
    enabled: Boolean(CONTRACT_ADDRESS),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      if (!CONTRACT_ADDRESS) {
        throw new Error('Contract address is not configured.');
      }
      const result = await fetchDeployedContractAbi(CONTRACT_ADDRESS);
      return {
        ...result,
        fns: resolveContractFunctions(result.abi),
      };
    },
  });
}

export function useAllTokensDecimalsMap() {
  const publicClient = usePublicClient();

  return useQuery<Record<string, { decimals: number; symbol: string }>>({
    queryKey: ['ratentuo-tokens-decimals'],
    enabled: Boolean(publicClient),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!publicClient) return {};
      const entries = await Promise.all(
        SUPPORTED_TOKENS.map(async (token) => {
          try {
            const [decimals, symbol] = await Promise.all([
              publicClient.readContract({
                address: token.address,
                abi: erc20Abi,
                functionName: 'decimals',
              }),
              publicClient.readContract({
                address: token.address,
                abi: erc20Abi,
                functionName: 'symbol',
              }),
            ]);
            return [
              token.address.toLowerCase(),
              { decimals: Number(decimals), symbol: String(symbol) },
            ] as const;
          } catch {
            return [
              token.address.toLowerCase(),
              { decimals: 6, symbol: token.fallbackSymbol },
            ] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
  });
}

export function useRequestsAndStats() {
  const publicClient = usePublicClient();
  const abiQuery = useContractAbi();

  return useQuery<{
    requests: NormalizedRequest[];
    stats: NormalizedPlatformStats;
  }>({
    queryKey: ['ratentuo-requests-and-stats', CONTRACT_ADDRESS, abiQuery.data?.sourceAddress],
    enabled: Boolean(publicClient && CONTRACT_ADDRESS && abiQuery.data),
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!publicClient || !CONTRACT_ADDRESS || !abiQuery.data) {
        return {
          requests: [],
          stats: { totalRequests: 0, activeRequests: 0, settledRequests: 0, totalBids: 0 },
        };
      }

      const contractAddr = CONTRACT_ADDRESS;
      const { abi, fns } = abiQuery.data;
      let requests: NormalizedRequest[] = [];

      if (fns.getAllRequests) {
        const rawList = await publicClient.readContract({
          address: contractAddr,
          abi,
          functionName: fns.getAllRequests.name,
        });
        if (Array.isArray(rawList)) {
          requests = rawList
            .map((item, idx) => normalizeRequest(item, BigInt(idx), fns.getAllRequests))
            .filter((r): r is NormalizedRequest => r !== null);
        }
      } else if (fns.getRequestCount && fns.getRequest) {
        const rawCount = await publicClient.readContract({
          address: contractAddr,
          abi,
          functionName: fns.getRequestCount.name,
        });
        const count = Number(rawCount ?? 0);
        if (count > 0) {
          const isNextId = fns.getRequestCount.name.toLowerCase().includes('next');
          const indices: bigint[] = [];
          const start = isNextId ? 1 : 0;
          const end = count - 1;
          for (let i = start; i <= end; i++) {
            indices.push(BigInt(i));
          }

          if (indices.length === 0 && count > 0) {
            for (let i = 0; i < count; i++) indices.push(BigInt(i));
          }

          const results = await Promise.allSettled(
            indices.map((id) =>
              publicClient.readContract({
                address: contractAddr,
                abi,
                functionName: fns.getRequest!.name,
                args: [id],
              }),
            ),
          );

          const parsedZeroIndexed = results
            .map((res, idx) =>
              res.status === 'fulfilled'
                ? normalizeRequest(res.value, indices[idx], fns.getRequest)
                : null,
            )
            .filter((r): r is NormalizedRequest => r !== null);

          if (parsedZeroIndexed.length === 0 && !isNextId) {
            const oneBasedResults = await Promise.allSettled(
              Array.from({ length: count }, (_, idx) => BigInt(idx + 1)).map((id) =>
                publicClient.readContract({
                  address: contractAddr,
                  abi,
                  functionName: fns.getRequest!.name,
                  args: [id],
                }),
              ),
            );
            requests = oneBasedResults
              .map((res, idx) =>
                res.status === 'fulfilled'
                  ? normalizeRequest(res.value, BigInt(idx + 1), fns.getRequest)
                  : null,
              )
              .filter((r): r is NormalizedRequest => r !== null);
          } else {
            requests = parsedZeroIndexed;
          }
        }
      }

      let stats: NormalizedPlatformStats | null = null;
      if (fns.getPlatformStats) {
        try {
          const rawStats = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi,
            functionName: fns.getPlatformStats.name,
          });
          stats = normalizeStats(rawStats, fns.getPlatformStats);
        } catch {
          stats = null;
        }
      }

      const now = Math.floor(Date.now() / 1000);
      const computedStats: NormalizedPlatformStats = stats ?? {
        totalRequests: requests.length,
        activeRequests: requests.filter((r) => !r.settled && !r.cancelled && r.deadline > now).length,
        settledRequests: requests.filter((r) => r.settled).length,
        totalBids: requests.reduce((acc, r) => acc + r.bidCount, 0),
      };

      return {
        requests: [...requests].sort((a, b) => Number(b.id - a.id)),
        stats: computedStats,
      };
    },
  });
}

export function useRequestDetail(requestIdParam?: string) {
  const publicClient = usePublicClient();
  const abiQuery = useContractAbi();

  const parsedId =
    requestIdParam !== undefined && /^\d+$/.test(requestIdParam)
      ? BigInt(requestIdParam)
      : undefined;

  return useQuery<{
    request: NormalizedRequest | null;
    bids: NormalizedBid[];
  }>({
    queryKey: ['ratentuo-request-detail', CONTRACT_ADDRESS, requestIdParam, abiQuery.data?.sourceAddress],
    enabled: Boolean(publicClient && CONTRACT_ADDRESS && abiQuery.data && parsedId !== undefined),
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!publicClient || !CONTRACT_ADDRESS || !abiQuery.data || parsedId === undefined) {
        return { request: null, bids: [] };
      }

      const { abi, fns } = abiQuery.data;
      let request: NormalizedRequest | null = null;

      if (fns.getRequest) {
        const rawReq = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi,
          functionName: fns.getRequest.name,
          args: [parsedId],
        });
        request = normalizeRequest(rawReq, parsedId, fns.getRequest);
      } else if (fns.getAllRequests) {
        const rawList = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi,
          functionName: fns.getAllRequests.name,
        });
        if (Array.isArray(rawList)) {
          const all = rawList
            .map((item, idx) => normalizeRequest(item, BigInt(idx), fns.getAllRequests))
            .filter((r): r is NormalizedRequest => r !== null);
          request = all.find((r) => r.id === parsedId) ?? null;
        }
      }

      let bids: NormalizedBid[] = [];
      if (fns.getBidsForRequest) {
        const rawBids = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi,
          functionName: fns.getBidsForRequest.name,
          args: [parsedId],
        });
        if (Array.isArray(rawBids)) {
          bids = rawBids
            .map((item, idx) => normalizeBid(item, parsedId, idx, fns.getBidsForRequest))
            .filter((b): b is NormalizedBid => b !== null);
        }
      }

      return { request, bids };
    },
  });
}

export function useMyActivity(connectedAddress?: Address) {
  const publicClient = usePublicClient();
  const abiQuery = useContractAbi();
  const requestsQuery = useRequestsAndStats();

  return useQuery<{
    myRequests: NormalizedRequest[];
    myBids: NormalizedBid[];
  }>({
    queryKey: [
      'ratentuo-my-activity',
      CONTRACT_ADDRESS,
      connectedAddress,
      abiQuery.data?.sourceAddress,
      requestsQuery.data?.requests.length,
    ],
    enabled: Boolean(publicClient && CONTRACT_ADDRESS && abiQuery.data && connectedAddress),
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!publicClient || !CONTRACT_ADDRESS || !abiQuery.data || !connectedAddress) {
        return { myRequests: [], myBids: [] };
      }

      const { abi, fns } = abiQuery.data;
      const lowerAddr = connectedAddress.toLowerCase();
      let myRequests: NormalizedRequest[] = [];
      let myBids: NormalizedBid[] = [];

      if (fns.getRequestsByBuyer) {
        try {
          const raw = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi,
            functionName: fns.getRequestsByBuyer.name,
            args: [connectedAddress],
          });
          if (Array.isArray(raw)) {
            if (raw.length > 0 && (typeof raw[0] === 'bigint' || typeof raw[0] === 'number')) {
              const all = requestsQuery.data?.requests ?? [];
              const idSet = new Set(raw.map((id) => BigInt(id).toString()));
              myRequests = all.filter((r) => idSet.has(r.id.toString()));
            } else {
              myRequests = raw
                .map((item, idx) => normalizeRequest(item, BigInt(idx), fns.getRequestsByBuyer))
                .filter((r): r is NormalizedRequest => r !== null);
            }
          }
        } catch {
          myRequests = (requestsQuery.data?.requests ?? []).filter(
            (r) => r.buyer.toLowerCase() === lowerAddr,
          );
        }
      } else {
        myRequests = (requestsQuery.data?.requests ?? []).filter(
          (r) => r.buyer.toLowerCase() === lowerAddr,
        );
      }

      if (fns.getBidsBySeller) {
        try {
          const raw = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi,
            functionName: fns.getBidsBySeller.name,
            args: [connectedAddress],
          });
          if (Array.isArray(raw)) {
            myBids = raw
              .map((item, idx) => normalizeBid(item, 0n, idx, fns.getBidsBySeller))
              .filter((b): b is NormalizedBid => b !== null);
          }
        } catch {
          myBids = [];
        }
      } else if (fns.getBidsForRequest && requestsQuery.data?.requests.length) {
        const allBidResults = await Promise.allSettled(
          requestsQuery.data.requests.map((req) =>
            publicClient.readContract({
              address: CONTRACT_ADDRESS!,
              abi,
              functionName: fns.getBidsForRequest!.name,
              args: [req.id],
            }),
          ),
        );
        allBidResults.forEach((res, idx) => {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            const reqId = requestsQuery.data!.requests[idx].id;
            res.value.forEach((item, bIdx) => {
              const normalized = normalizeBid(item, reqId, bIdx, fns.getBidsForRequest);
              if (normalized && normalized.bidder.toLowerCase() === lowerAddr) {
                myBids.push(normalized);
              }
            });
          }
        });
      }

      return { myRequests, myBids };
    },
  });
}

export function useTxLifecycle() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const [state, setState] = useState<TxLifecycleState>({ phase: 'idle' });

  const reset = useCallback(() => {
    setState({ phase: 'idle' });
  }, []);

  const execute = useCallback(
    async (writeParams: Parameters<typeof writeContractAsync>[0]) => {
      try {
        setState({ phase: 'pending' });
        const hash = await writeContractAsync(writeParams);
        setState({ phase: 'confirming', hash });

        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status === 'reverted') {
            setState({
              phase: 'error',
              hash,
              error: 'Transaction reverted on-chain.',
            });
            return null;
          }
        }

        setState({ phase: 'confirmed', hash });
        await queryClient.invalidateQueries({ queryKey: ['ratentuo-requests-and-stats'] });
        await queryClient.invalidateQueries({ queryKey: ['ratentuo-request-detail'] });
        await queryClient.invalidateQueries({ queryKey: ['ratentuo-my-activity'] });
        return hash;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message.split('\n')[0]
            : 'Transaction failed or was rejected.';
        setState({ phase: 'error', error: message });
        return null;
      }
    },
    [publicClient, queryClient, writeContractAsync],
  );

  return { state, execute, reset };
}

export { buildCreateRequestArgs, buildPlaceBidArgs, buildSettleArgs };
