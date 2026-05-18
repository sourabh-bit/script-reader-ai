import { cn } from "@/lib/utils";

export function AppLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("h-11 w-11", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#rxdecode-logo-bg)" />
      <path
        d="M20 22.5C20 18.9101 22.9101 16 26.5 16H34C40.0751 16 45 20.9249 45 27C45 32.6169 40.7853 37.248 35.35 37.9052L42 48H35.6L29.65 38.6H26V48H20V22.5ZM26 33.5H33.6C37.0242 33.5 39.8 30.7242 39.8 27.3C39.8 23.8758 37.0242 21.1 33.6 21.1H26V33.5Z"
        fill="white"
      />
      <path d="M46 17H49V24H56V27H49V34H46V27H39V24H46V17Z" fill="#F6D365" />
      <defs>
        <linearGradient id="rxdecode-logo-bg" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1F8A8A" />
          <stop offset="1" stopColor="#0F4C75" />
        </linearGradient>
      </defs>
    </svg>
  );
}
