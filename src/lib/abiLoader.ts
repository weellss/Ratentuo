import type { Abi, AbiFunction, AbiParameter, Address } from 'viem';
import { zeroAddress } from 'viem';
import { ARC_EXPLORER_URL } from '../config/chain';

export interface FetchedAbiResult {
  abi: Abi;
  contractName: string | null;
  isVerified: boolean;
  sourceAddress: Address;
}

export interface NormalizedRequest {
  id: bigint;
  buyer: Address;
  title: string;
  description: string;
  token: Address;
  maxBudget: bigint;
  deadline: number;
  lowestBid: bigint;
  lowestBidder: Address;
  bidCount: number;
  settled: boolean;
  cancelled: boolean;
  createdAt: number;
}

export interface NormalizedBid {
  id: string;
  requestId: bigint;
  bidder: Address;
  amount: bigint;
  timestamp: number;
}

export interface NormalizedPlatformStats {
  totalRequests: number;
  activeRequests: number;
  settledRequests: number;
  totalBids: number;
}

export interface ResolvedContractFunctions {
  createRequest?: AbiFunction;
  placeBid?: AbiFunction;
  settle?: AbiFunction;
  getRequest?: AbiFunction;
  getAllRequests?: AbiFunction;
  getRequestCount?: AbiFunction;
  getBidsForRequest?: AbiFunction;
  getRequestsByBuyer?: AbiFunction;
  getBidsBySeller?: AbiFunction;
  getPlatformStats?: AbiFunction;
}

const abiCache = new Map<string, FetchedAbiResult>();

async function fetchBlockscoutV2(address: Address): Promise<FetchedAbiResult | null> {
  try {
    const response = await fetch(`${ARC_EXPLORER_URL}/api/v2/smart-contracts/${address}`);
    if (!response.ok) return null;
    const data = await response.json();

    if (Array.isArray(data?.implementations) && data.implementations.length > 0) {
      const implAddr = data.implementations[0]?.address;
      if (implAddr && typeof implAddr === 'string') {
        const implRes = await fetch(`${ARC_EXPLORER_URL}/api/v2/smart-contracts/${implAddr}`);
        if (implRes.ok) {
          const implData = await implRes.json();
          if (Array.isArray(implData?.abi) && implData.abi.length > 0) {
            return {
              abi: implData.abi as Abi,
              contractName: implData.name ?? data.name ?? null,
              isVerified: Boolean(implData.is_verified ?? data.is_verified),
              sourceAddress: address,
            };
          }
        }
      }
    }

    if (Array.isArray(data?.abi) && data.abi.length > 0) {
      return {
        abi: data.abi as Abi,
        contractName: data.name ?? null,
        isVerified: Boolean(data.is_verified),
        sourceAddress: address,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchBlockscoutV1(address: Address): Promise<FetchedAbiResult | null> {
  try {
    const response = await fetch(
      `${ARC_EXPLORER_URL}/api?module=contract&action=getabi&address=${address}`,
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.status === '1' && typeof data?.result === 'string') {
      const parsed = JSON.parse(data.result);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          abi: parsed as Abi,
          contractName: null,
          isVerified: true,
          sourceAddress: address,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchDeployedContractAbi(address: Address): Promise<FetchedAbiResult> {
  const key = address.toLowerCase();
  const cached = abiCache.get(key);
  if (cached) return cached;

  const v2 = await fetchBlockscoutV2(address);
  if (v2) {
    abiCache.set(key, v2);
    return v2;
  }

  const v1 = await fetchBlockscoutV1(address);
  if (v1) {
    abiCache.set(key, v1);
    return v1;
  }

  throw new Error('Unable to fetch verified ABI from the deployed contract on ArcScan.');
}

function getAbiFunctions(abi: Abi): AbiFunction[] {
  return abi.filter((item): item is AbiFunction => item.type === 'function');
}

function findFn(
  fns: AbiFunction[],
  candidates: string[],
  mutability: 'view' | 'write',
  predicate?: (fn: AbiFunction) => boolean,
): AbiFunction | undefined {
  const matchingMutability = fns.filter((fn) =>
    mutability === 'view'
      ? fn.stateMutability === 'view' || fn.stateMutability === 'pure'
      : fn.stateMutability === 'nonpayable' || fn.stateMutability === 'payable',
  );

  for (const candidate of candidates) {
    const exact = matchingMutability.find(
      (fn) => fn.name.toLowerCase() === candidate.toLowerCase() && (!predicate || predicate(fn)),
    );
    if (exact) return exact;
  }

  if (predicate) {
    return matchingMutability.find((fn) => predicate(fn));
  }

  return undefined;
}

export function resolveContractFunctions(abi: Abi): ResolvedContractFunctions {
  const fns = getAbiFunctions(abi);

  return {
    createRequest: findFn(
      fns,
      ['createRequest', 'postRequest', 'createAuction', 'submitRequest', 'openRequest', 'create'],
      'write',
      (fn) => fn.inputs.length >= 4,
    ),
    placeBid: findFn(
      fns,
      ['placeBid', 'submitBid', 'bid', 'makeBid'],
      'write',
      (fn) => fn.inputs.length === 2,
    ),
    settle: findFn(
      fns,
      ['settle', 'settleRequest', 'settleAuction', 'finalize', 'finalizeAuction', 'closeAuction'],
      'write',
      (fn) => fn.inputs.length === 1,
    ),
    getRequest: findFn(
      fns,
      ['getRequest', 'requests', 'getAuction', 'auctions', 'requestById'],
      'view',
      (fn) => fn.inputs.length === 1 && fn.inputs[0].type.startsWith('uint'),
    ),
    getAllRequests: findFn(
      fns,
      ['getAllRequests', 'getRequests', 'getAllAuctions', 'getAuctions', 'allRequests'],
      'view',
      (fn) => fn.inputs.length === 0,
    ),
    getRequestCount: findFn(
      fns,
      [
        'requestCount',
        'getRequestCount',
        'totalRequests',
        'auctionCount',
        'getAuctionCount',
        'nextRequestId',
        'nextAuctionId',
      ],
      'view',
      (fn) => fn.inputs.length === 0,
    ),
    getBidsForRequest: findFn(
      fns,
      [
        'getBidsForRequest',
        'getRequestBids',
        'getBids',
        'getAuctionBids',
        'bidsForRequest',
        'requestBids',
      ],
      'view',
      (fn) => fn.inputs.length === 1 && fn.inputs[0].type.startsWith('uint'),
    ),
    getRequestsByBuyer: findFn(
      fns,
      ['getRequestsByBuyer', 'getBuyerRequests', 'buyerRequests', 'requestsOf'],
      'view',
      (fn) => fn.inputs.length === 1 && fn.inputs[0].type === 'address',
    ),
    getBidsBySeller: findFn(
      fns,
      ['getBidsBySeller', 'getSellerBids', 'sellerBids', 'getBidsByBidder', 'bidsOf'],
      'view',
      (fn) => fn.inputs.length === 1 && fn.inputs[0].type === 'address',
    ),
    getPlatformStats: findFn(
      fns,
      ['getPlatformStats', 'platformStats', 'getStats', 'stats', 'getSummary'],
      'view',
      (fn) => fn.inputs.length === 0,
    ),
  };
}

export function buildCreateRequestArgs(
  fn: AbiFunction,
  params: {
    title: string;
    description: string;
    token: Address;
    maxBudget: bigint;
    deadlineSeconds: number;
  },
): unknown[] {
  const nowSec = Math.floor(Date.now() / 1000);
  return fn.inputs.map((input, index) => {
    const name = (input.name ?? '').toLowerCase();
    const type = input.type;

    if (type === 'address') {
      return params.token;
    }

    if (type === 'string') {
      if (name.includes('desc') || name.includes('detail') || name.includes('spec')) {
        return params.description;
      }
      if (name.includes('title') || name.includes('name') || name.includes('subject')) {
        return params.title;
      }
      const stringIndex = fn.inputs
        .slice(0, index + 1)
        .filter((i) => i.type === 'string').length;
      return stringIndex === 1 ? params.title : params.description;
    }

    if (type.startsWith('uint')) {
      if (name.includes('duration') || name.includes('period') || name.includes('length')) {
        return BigInt(Math.max(60, params.deadlineSeconds - nowSec));
      }
      if (name.includes('dead') || name.includes('end') || name.includes('expir') || name.includes('time')) {
        return BigInt(params.deadlineSeconds);
      }
      if (name.includes('budget') || name.includes('amount') || name.includes('max') || name.includes('cap')) {
        return params.maxBudget;
      }
      const uintIndex = fn.inputs
        .slice(0, index + 1)
        .filter((i) => i.type.startsWith('uint')).length;
      return uintIndex === 1 ? params.maxBudget : BigInt(params.deadlineSeconds);
    }

    return params.maxBudget;
  });
}

export function buildPlaceBidArgs(
  fn: AbiFunction,
  requestId: bigint,
  amount: bigint,
): unknown[] {
  return fn.inputs.map((input, index) => {
    const name = (input.name ?? '').toLowerCase();
    if (name.includes('amount') || name.includes('bid') || name.includes('price') || name.includes('value')) {
      if (!name.includes('id')) return amount;
    }
    if (name.includes('id') || name.includes('request') || name.includes('auction')) {
      return requestId;
    }
    return index === 0 ? requestId : amount;
  });
}

export function buildSettleArgs(fn: AbiFunction, requestId: bigint): unknown[] {
  if (fn.inputs.length === 0) return [];
  return [requestId];
}

function toBigIntSafe(val: unknown, fallback = 0n): bigint {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number' && Number.isFinite(val)) return BigInt(Math.trunc(val));
  if (typeof val === 'string' && /^\d+$/.test(val)) return BigInt(val);
  return fallback;
}

function toNumberSafe(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'bigint') return Number(val);
  if (typeof val === 'string' && /^\d+$/.test(val)) return Number(val);
  return fallback;
}

function toAddressSafe(val: unknown): Address {
  if (typeof val === 'string' && val.startsWith('0x') && val.length === 42) {
    return val as Address;
  }
  return zeroAddress;
}

function extractStructFields(raw: unknown, outputDef?: readonly AbiParameter[]): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  if (Array.isArray(raw)) {
    const record: Record<string, unknown> = {};
    const fields =
      outputDef && outputDef.length === 1 && 'components' in outputDef[0] && outputDef[0].components
        ? outputDef[0].components
        : outputDef ?? [];

    raw.forEach((val, idx) => {
      const key = fields[idx]?.name || `_${idx}`;
      record[key] = val;
      record[`_${idx}`] = val;
    });
    return record;
  }

  return {};
}

function pickField(obj: Record<string, unknown>, keys: string[]): unknown {
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    lowerMap.set(k.toLowerCase(), v);
  }
  for (const candidate of keys) {
    const hit = lowerMap.get(candidate.toLowerCase());
    if (hit !== undefined) return hit;
  }
  return undefined;
}

export function normalizeRequest(
  raw: unknown,
  fallbackId: bigint,
  fn?: AbiFunction,
): NormalizedRequest | null {
  if (raw === null || raw === undefined) return null;

  const data = extractStructFields(raw, fn?.outputs);

  const id = toBigIntSafe(
    pickField(data, ['id', 'requestId', 'auctionId']),
    fallbackId,
  );
  const buyer = toAddressSafe(
    pickField(data, ['buyer', 'creator', 'owner', 'requester', 'client']),
  );
  const title = String(pickField(data, ['title', 'name', 'subject']) ?? '');
  const description = String(pickField(data, ['description', 'details', 'spec', 'body']) ?? '');
  const token = toAddressSafe(
    pickField(data, ['token', 'paymentToken', 'currency', 'asset']),
  );
  const maxBudget = toBigIntSafe(
    pickField(data, ['maxBudget', 'budget', 'maxAmount', 'escrowAmount', 'amount']),
  );
  const deadline = toNumberSafe(
    pickField(data, ['deadline', 'endTime', 'endsAt', 'expiry', 'expiresAt']),
  );
  const lowestBid = toBigIntSafe(
    pickField(data, ['lowestBid', 'bestBid', 'currentLowestBid', 'winningBid', 'lowestAmount']),
  );
  const lowestBidder = toAddressSafe(
    pickField(data, ['lowestBidder', 'bestBidder', 'winner', 'currentWinner', 'leadingBidder']),
  );
  const bidCount = toNumberSafe(
    pickField(data, ['bidCount', 'totalBids', 'bidsCount', 'numBids']),
  );
  const settled = Boolean(
    pickField(data, ['settled', 'isSettled', 'finalized', 'completed', 'claimed']) ?? false,
  );
  const cancelled = Boolean(
    pickField(data, ['cancelled', 'canceled', 'isCancelled']) ?? false,
  );
  const createdAt = toNumberSafe(
    pickField(data, ['createdAt', 'timestamp', 'startTime']),
  );

  if (buyer === zeroAddress && !title && maxBudget === 0n && deadline === 0) {
    return null;
  }

  return {
    id,
    buyer,
    title: title || `Request #${id.toString()}`,
    description,
    token,
    maxBudget,
    deadline,
    lowestBid,
    lowestBidder,
    bidCount,
    settled,
    cancelled,
    createdAt,
  };
}

export function normalizeBid(
  raw: unknown,
  fallbackRequestId: bigint,
  index: number,
  fn?: AbiFunction,
): NormalizedBid | null {
  if (raw === null || raw === undefined) return null;
  const data = extractStructFields(raw, fn?.outputs);

  const requestId = toBigIntSafe(
    pickField(data, ['requestId', 'auctionId', 'reqId']),
    fallbackRequestId,
  );
  const bidder = toAddressSafe(
    pickField(data, ['bidder', 'seller', 'provider', 'sender', 'maker']),
  );
  const amount = toBigIntSafe(
    pickField(data, ['amount', 'bidAmount', 'price', 'value']),
  );
  const timestamp = toNumberSafe(
    pickField(data, ['timestamp', 'createdAt', 'placedAt', 'time']),
  );

  if (bidder === zeroAddress && amount === 0n) return null;

  return {
    id: `${requestId.toString()}-${bidder}-${amount.toString()}-${index}`,
    requestId,
    bidder,
    amount,
    timestamp,
  };
}

export function normalizeStats(
  raw: unknown,
  fn?: AbiFunction,
): NormalizedPlatformStats | null {
  if (raw === null || raw === undefined) return null;
  const data = extractStructFields(raw, fn?.outputs);

  const totalRequests = toNumberSafe(
    pickField(data, ['totalRequests', 'totalAuctions', 'requestCount', 'auctionCount', '_0']),
  );
  const activeRequests = toNumberSafe(
    pickField(data, ['activeRequests', 'openRequests', 'liveAuctions', 'activeAuctions', '_1']),
  );
  const settledRequests = toNumberSafe(
    pickField(data, ['settledRequests', 'settledAuctions', 'completedRequests', '_2']),
  );
  const totalBids = toNumberSafe(
    pickField(data, ['totalBids', 'bidsCount', 'totalBidsPlaced', '_3']),
  );

  return {
    totalRequests,
    activeRequests,
    settledRequests,
    totalBids,
  };
}
