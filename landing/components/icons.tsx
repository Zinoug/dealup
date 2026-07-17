import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  fill: "none",
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
} as const;

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.4 2.8 8.3 7 10 4.2-1.7 7-5.6 7-10V6l-7-3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M12 2c.8 5.1 2.9 7.2 8 8-5.1.8-7.2 2.9-8 8-.8-5.1-2.9-7.2-8-8 5.1-.8 7.2-2.9 8-8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M19 17c.3 2 1.1 2.7 3 3-1.9.3-2.7 1-3 3-.3-2-1.1-2.7-3-3 1.9-.3 2.7-1 3-3Z" fill="currentColor" />
    </svg>
  );
}

export function PriceIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M20 13 13 20 4 11V4h7l9 9Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M20 15a3 3 0 0 1-3 3H9l-5 3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M8 9h8M8 13h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function AppleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props} aria-hidden="true">
      <path fill="currentColor" d="M17.1 12.6c0-2.7 2.2-4 2.3-4.1a5 5 0 0 0-3.9-2.1c-1.7-.2-3.3 1-4.1 1-.9 0-2.2-1-3.6-1-1.8 0-3.6 1.1-4.5 2.8-1.9 3.3-.5 8.2 1.4 10.9.9 1.3 2 2.8 3.5 2.7 1.4 0 2-1 3.7-1s2.2 1 3.7 1c1.5 0 2.5-1.3 3.4-2.7a12 12 0 0 0 1.6-3.2 4.7 4.7 0 0 1-3.5-4.3ZM14.4 4.7A4.8 4.8 0 0 0 15.5 1a4.9 4.9 0 0 0-3.2 1.7 4.6 4.6 0 0 0-1.2 3.5c1.2.1 2.4-.5 3.3-1.5Z" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function DeviceIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.5 5h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <circle cx="12" cy="18.5" r=".8" fill="currentColor" />
    </svg>
  );
}

export function LaptopIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <rect x="4" y="4" width="16" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2.5 18h19l-1 2h-17l-1-2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

