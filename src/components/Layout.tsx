import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AlertCircle, Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { CONTRACT_ADDRESS, getAddressExplorerUrl } from '../config/contracts';
import { WALLET_ERROR_EVENT } from '../lib/polyfills';

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/auctions', label: 'Live Auctions' },
  { to: '/post', label: 'Post Request' },
  { to: '/activity', label: 'My Activity' },
];

export function Layout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletNotice, setWalletNotice] = useState<string | null>(null);

  useEffect(() => {
    function handleWalletError(event: Event) {
      const custom = event as CustomEvent<{ message?: string }>;
      if (custom.detail?.message) {
        setWalletNotice(custom.detail.message);
      }
    }
    window.addEventListener(WALLET_ERROR_EVENT, handleWalletError);
    return () => window.removeEventListener(WALLET_ERROR_EVENT, handleWalletError);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF8F1] text-[#1B1330]">
      <header className="sticky top-0 z-40 bg-[#FBF8F1]/95 backdrop-blur-sm border-b border-[#4B2E83]/12">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B2E83] rounded-md"
          >
            <Logo className="h-8 w-8 rounded-lg shrink-0" />
            <span className="font-display text-xl font-bold tracking-tight text-[#1B1330]">
              Ratentuo
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-7">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    isActive
                      ? 'text-[#1B1330] border-[#4B2E83] font-semibold'
                      : 'text-[#4D4634] border-transparent hover:text-[#1B1330] hover:border-[#4B2E83]/40'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                mounted,
              }) => {
                const connected = mounted && account && chain;

                if (!mounted) {
                  return (
                    <div className="h-10 w-32 rounded-lg bg-[#1B1330]/5" aria-hidden="true" />
                  );
                }

                if (!connected) {
                  return (
                    <button
                      type="button"
                      onClick={openConnectModal}
                      className="inline-flex items-center justify-center rounded-lg bg-[#FFD23F] px-4 py-2 font-display text-sm font-semibold text-[#1B1330] border border-[#1B1330]/20 transition-all hover:bg-[#FFE066] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(255,210,63,0.4)] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Connect Wallet
                    </button>
                  );
                }

                if (chain.unsupported) {
                  return (
                    <button
                      type="button"
                      onClick={openChainModal}
                      className="inline-flex items-center justify-center rounded-lg bg-[#4B2E83] px-4 py-2 font-display text-sm font-semibold text-white transition-colors hover:bg-[#5C39A1] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Switch to Arc
                    </button>
                  );
                }

                return (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={openChainModal}
                      className="hidden sm:inline-flex items-center rounded-lg bg-[#4B2E83] px-3 py-2 font-display text-xs font-semibold text-white transition-colors hover:bg-[#5C39A1] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Arc
                    </button>
                    <button
                      type="button"
                      onClick={openAccountModal}
                      className="inline-flex items-center rounded-lg bg-[#1B1330] px-3.5 py-2 font-mono-tabular text-xs font-semibold text-white transition-colors hover:bg-[#251A40] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {account.displayName}
                    </button>
                  </div>
                );
              }}
            </ConnectButton.Custom>

            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#4B2E83]/20 text-[#1B1330] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#4B2E83]/12 bg-[#FBF8F1] px-4 py-3">
            <nav aria-label="Mobile" className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-2.5 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-[#4B2E83] text-white font-semibold'
                        : 'text-[#1B1330] hover:bg-[#4B2E83]/5'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      {walletNotice && (
        <div
          role="alert"
          className="bg-[#FFD23F] border-b border-[#1B1330]/15 text-[#1B1330]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-2.5 flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">{walletNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setWalletNotice(null)}
              className="text-xs font-semibold underline underline-offset-4 hover:opacity-75 shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="bg-[#1B1330] text-white border-t border-[#4B2E83]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo className="h-6 w-6 rounded-md" />
              <p className="font-display text-base font-bold text-white">Built by Jack</p>
            </div>
            <p className="mt-2 text-sm text-[#D4CEE6]">
              Ratentuo is an independent project built on Arc.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-[#D4CEE6]">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="hover:text-white transition-colors whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
            {CONTRACT_ADDRESS && (
              <a
                href={getAddressExplorerUrl(CONTRACT_ADDRESS)}
                target="_blank"
                rel="noreferrer"
                className="font-mono-tabular text-xs text-[#FFD23F] hover:text-[#FFE066] underline underline-offset-4 whitespace-nowrap"
              >
                Contract on ArcScan
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
