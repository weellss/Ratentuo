interface LogoProps {
  className?: string;
}

export function Logo({ className = 'h-8 w-8' }: LogoProps) {
  return (
    <img
      src="/favicon.svg"
      alt="Ratentuo"
      className={className}
      width={32}
      height={32}
    />
  );
}
