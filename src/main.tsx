import {
  formatWalletErrorMessage,
  WALLET_ERROR_EVENT,
} from './lib/polyfills';
import '@rainbow-me/rainbowkit/styles.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import { wagmiConfig } from './config/wagmi';
import App from './App';

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      if (typeof window !== 'undefined' && error) {
        const msg = formatWalletErrorMessage(error);
        if (msg.toLowerCase().includes('at least one account') || msg.toLowerCase().includes('no active account')) {
          window.dispatchEvent(
            new CustomEvent(WALLET_ERROR_EVENT, { detail: { message: msg } }),
          );
        }
      }
    },
  }),
});

const ratentuoTheme = lightTheme({
  accentColor: '#4B2E83',
  accentColorForeground: '#FFFFFF',
  borderRadius: 'medium',
  fontStack: 'system',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={ratentuoTheme}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
