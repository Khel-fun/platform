import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function MetaMaskIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden {...props}>
      <rect width="32" height="32" rx="8" fill="#F6851B" />
      <path
        d="M24.5 8.5 17.2 13.1l1.4-3.2 6-1.4ZM7.5 8.5l7.2 4.6-1.3-3.2-5.9-1.4ZM17.2 13.1 16 17.4l-1.2-4.3 1.2-4.3 1.2 4.3Z"
        fill="#E2761B"
      />
      <path
        d="M7.5 8.5 10.4 20.1l5.6-6.9-1.3-3.2-7.2-1.5ZM24.5 8.5l-2.9 11.6-5.6-6.9 1.4-3.2 6-1.5ZM14.8 17.4 16 22.8l1.2-5.4-1.2-4.3-1.2 4.3Z"
        fill="#E4761B"
      />
      <path
        d="M10.4 20.1 14.8 17.4 16 22.8 10.4 20.1ZM21.6 20.1 17.2 17.4 16 22.8l5.6-2.7Z"
        fill="#D7C1B3"
      />
      <path
        d="M10.4 20.1 11.8 24.5 16 22.8 10.4 20.1ZM21.6 20.1 20.2 24.5 16 22.8l5.6-2.7Z"
        fill="#233447"
      />
      <path
        d="M16 22.8 11.8 24.5 13.4 26.2 18.6 26.2 20.2 24.5 16 22.8Z"
        fill="#CD6116"
      />
    </svg>
  );
}

export function RainbowIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden {...props}>
      <rect width="32" height="32" rx="8" fill="#001E59" />
      <path
        d="M16 24c-4.4 0-8-3.6-8-8 0-2.2.9-4.2 2.3-5.7"
        stroke="#FF4000"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M16 24c4.4 0 8-3.6 8-8 0-2.2-.9-4.2-2.3-5.7"
        stroke="#FFCC00"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M16 24c-2.8 0-5-2.2-5-5 0-1.4.6-2.7 1.5-3.6"
        stroke="#00FF95"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M16 24c2.8 0 5-2.2 5-5 0-1.4-.6-2.7-1.5-3.6"
        stroke="#0099FF"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PhantomIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden {...props}>
      <rect width="32" height="32" rx="8" fill="#AB9FF2" />
      <path
        d="M10 12.5c0-2.2 1.8-4 4-4h4c2.2 0 4 1.8 4 4v1.5H10V12.5Z"
        fill="#FFF"
      />
      <circle cx="13.5" cy="13" r="1.2" fill="#AB9FF2" />
      <circle cx="18.5" cy="13" r="1.2" fill="#AB9FF2" />
      <path
        d="M10 16.5h12v3.5c0 2.2-1.8 4-4 4h-4c-2.2 0-4-1.8-4-4v-3.5Z"
        fill="#FFF"
      />
    </svg>
  );
}

export function CoinbaseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden {...props}>
      <rect width="32" height="32" rx="8" fill="#0052FF" />
      <rect x="11" y="11" width="10" height="10" rx="2" fill="#FFF" />
    </svg>
  );
}

export function WalletConnectIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden {...props}>
      <rect width="32" height="32" rx="8" fill="#3B99FC" />
      <path
        d="M10.2 13.1c3.4-3.3 8.9-3.3 12.3 0l.4.4c.2.2.2.5 0 .7l-1.4 1.4c-.1.1-.3.1-.4 0l-.6-.6c-2.4-2.3-6.2-2.3-8.6 0l-.6.6c-.1.1-.3.1-.4 0l-1.4-1.4c-.2-.2-.2-.5 0-.7l.4-.4Zm-2.2 2.2 1.4 1.4c.2.2.5.2.7 0 1.6-1.5 3.7-2.3 5.9-2.3s4.3.8 5.9 2.3c.2.2.5.2.7 0l1.4-1.4c.2-.2.2-.5 0-.7l-1.4-1.4c-3.4-3.3-8.9-3.3-12.3 0l-1.4 1.4c-.2.2-.2.5 0 .7Zm14.8 2.8-1.3 1.3c-.1.1-.3.1-.4 0-1.1-1-2.5-1.6-4-1.6s-2.9.6-4 1.6c-.1.1-.3.1-.4 0l-1.3-1.3c-.2-.2-.2-.5 0-.7 1.5-1.4 3.5-2.2 5.7-2.2s4.2.8 5.7 2.2c.2.2.2.5 0 .7Z"
        fill="#FFF"
      />
    </svg>
  );
}
