import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';

interface ConnectWalletPromptProps {
  title: string;
  description: string;
  dark?: boolean;
}

export function ConnectWalletPrompt({
  title,
  description,
  dark = false,
}: ConnectWalletPromptProps) {
  const { openConnectModal } = useConnectModal();

  return (
    <div
      className={
        dark
          ? 'strike-board-tile p-6 text-center'
          : 'strike-card p-8 md:p-10 text-center max-w-xl mx-auto'
      }
    >
      <div
        className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
          dark
            ? 'bg-[#FFD23F] text-[#1B1330]'
            : 'bg-[#1B1330] text-[#FFD23F]'
        }`}
      >
        <Wallet className="h-5 w-5" />
      </div>
      <h3
        className={`font-display text-xl font-bold ${
          dark ? 'text-white' : 'text-[#1B1330]'
        }`}
      >
        {title}
      </h3>
      <p
        className={`mt-2 text-sm leading-relaxed ${
          dark ? 'text-[#D4CEE6]' : 'text-[#4D4634]'
        }`}
      >
        {description}
      </p>
      <button
        type="button"
        onClick={() => openConnectModal?.()}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFD23F] px-5 py-2.5 font-display text-sm font-semibold text-[#1B1330] border border-[#1B1330]/20 transition-all hover:bg-[#FFE066] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(255,210,63,0.4)] whitespace-nowrap cursor-pointer"
      >
        Connect Wallet
      </button>
    </div>
  );
}
