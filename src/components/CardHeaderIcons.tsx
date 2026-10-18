import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  title?: string;
};

const baseProps = (size: number, title: string | undefined) => ({
  width: size,
  height: size,
  viewBox: "0 0 64 64",
  fill: "none",
  role: title ? "img" : undefined,
  "aria-hidden": title ? undefined : true,
  "aria-label": title,
  xmlns: "http://www.w3.org/2000/svg",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function GameControllerIcon({ size = 48, title, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, title)} {...props} stroke="#8B5CF6" strokeWidth="2.5">
      <path d="M19 22h26a9 9 0 0 1 8.7 6.7l3.1 12.1a5.2 5.2 0 0 1-8.2 5.4l-7.1-5.4H22.5l-7.1 5.4a5.2 5.2 0 0 1-8.2-5.4l3.1-12.1A9 9 0 0 1 19 22Z" />
      <path d="M22 29v10M17 34h10" />
      <circle cx="43" cy="31" r="1.5" fill="#8B5CF6" stroke="none" />
      <circle cx="48" cy="36" r="1.5" fill="#8B5CF6" stroke="none" />
    </svg>
  );
}

export function CodeInspectionIcon({ size = 48, title, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, title)} {...props} stroke="#EF4444" strokeWidth="2.5">
      <path d="m24 20-12 12 12 12M40 20l12 12-12 12M37 22l-10 20" />
      <path d="m43 42 10 12 2-7 6-3-18-2Z" fill="#EF4444" stroke="none" />
    </svg>
  );
}

export function DossierSearchIcon({ size = 48, title, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, title)} {...props} stroke="#06B6D4" strokeWidth="2.5">
      <path d="M16 9h22l10 10v13M38 9v11h10M21 26h12M21 32h9" />
      <path d="M16 9v43h19" />
      <circle cx="42" cy="42" r="8" />
      <path d="m48 48 7 7" />
    </svg>
  );
}

export function UnlockedTerminalIcon({ size = 48, title, ...props }: IconProps) {
  return (
    <svg {...baseProps(size, title)} {...props} stroke="#F59E0B" strokeWidth="2.5">
      <path d="M24 25v-6a10 10 0 0 1 18-6" />
      <rect x="15" y="25" width="36" height="28" rx="5" />
      <path d="m25 35 5 4-5 4M34 43h8" />
    </svg>
  );
}
