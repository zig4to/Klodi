// Znak aplikacije Klodi: bel oblak na prelivu #0ea5e9 → #6366f1
// (enako kot src/app/icon.svg in public/icon.svg — ob spremembi posodobi vse tri).
export default function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="cc-logo-g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0EA5E9" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="149" fill="url(#cc-logo-g)" />
      <g transform="translate(256 256) scale(11.5) translate(-12 -14)" fill="#fff">
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      </g>
    </svg>
  );
}
