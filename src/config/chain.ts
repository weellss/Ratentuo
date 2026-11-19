import { defineChain } from 'viem';

export const ARC_CHAIN_ID = 5042002;
export const ARC_RPC_URL = 'https://rpc.testnet.arc.network';
export const ARC_EXPLORER_URL = 'https://testnet.arcscan.app';

export const arcChain = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [ARC_RPC_URL],
    },
    public: {
      http: [ARC_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: ARC_EXPLORER_URL,
    },
  },
});
