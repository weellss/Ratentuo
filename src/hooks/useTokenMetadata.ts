import { useCallback } from 'react';
import { erc20Abi, type Address, zeroAddress } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESS, getTokenConfigByAddress } from '../config/contracts';

export interface TokenMetadata {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint | undefined;
  allowance: bigint | undefined;
  isLoading: boolean;
  refetch: () => void;
}

export function useTokenMetadata(tokenAddress?: Address | null): TokenMetadata {
  const { address: userAddress } = useAccount();

  const validToken =
    tokenAddress && tokenAddress !== zeroAddress ? tokenAddress : undefined;

  const fallbackConfig = getTokenConfigByAddress(validToken);

  const decimalsQuery = useReadContract({
    address: validToken,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: Boolean(validToken), staleTime: 60_000 },
  });

  const symbolQuery = useReadContract({
    address: validToken,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled: Boolean(validToken), staleTime: 60_000 },
  });

  const nameQuery = useReadContract({
    address: validToken,
    abi: erc20Abi,
    functionName: 'name',
    query: { enabled: Boolean(validToken), staleTime: 60_000 },
  });

  const balanceQuery = useReadContract({
    address: validToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: Boolean(validToken && userAddress), staleTime: 15_000 },
  });

  const allowanceQuery = useReadContract({
    address: validToken,
    abi: erc20Abi,
    functionName: 'allowance',
    args: userAddress && CONTRACT_ADDRESS ? [userAddress, CONTRACT_ADDRESS] : undefined,
    query: {
      enabled: Boolean(validToken && userAddress && CONTRACT_ADDRESS),
      staleTime: 15_000,
    },
  });

  const refetch = useCallback(() => {
    void decimalsQuery.refetch();
    void symbolQuery.refetch();
    void nameQuery.refetch();
    void balanceQuery.refetch();
    void allowanceQuery.refetch();
  }, [allowanceQuery, balanceQuery, decimalsQuery, nameQuery, symbolQuery]);

  return {
    address: validToken ?? zeroAddress,
    symbol: symbolQuery.data ?? fallbackConfig?.fallbackSymbol ?? 'TOKEN',
    name: nameQuery.data ?? fallbackConfig?.label ?? 'ERC20 Token',
    decimals: decimalsQuery.data !== undefined ? Number(decimalsQuery.data) : 6,
    balance: balanceQuery.data,
    allowance: allowanceQuery.data,
    isLoading:
      decimalsQuery.isLoading ||
      symbolQuery.isLoading ||
      balanceQuery.isLoading ||
      allowanceQuery.isLoading,
    refetch,
  };
}
