// Lucide-slog: 24x24, stroke currentColor, brez polnila.
import type { SVGProps } from "react";

function Base({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconCamera = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </Base>
);

export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </Base>
);

export const IconEuro = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 10h12" />
    <path d="M4 14h9" />
    <path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2" />
  </Base>
);

export const IconEye = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

export const IconEyeOff = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.1" />
    <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m2 2 20 20" />
  </Base>
);

export const IconReceipt = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
    <path d="M12 17.5v-11" />
  </Base>
);

export const IconRepeat = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </Base>
);

export const IconMinus = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M5 12h14" />
  </Base>
);

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </Base>
);

export const IconTag = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12.6 2.6a2 2 0 0 0-1.4-.6H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.2 8.2a2 2 0 0 0 2.8 0l6.8-6.8a2 2 0 0 0 0-2.8Z" />
    <circle cx="7.5" cy="7.5" r="1.2" />
  </Base>
);

export const IconFilter = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M22 3H2l8 9.5V19l4 2v-8.5Z" />
  </Base>
);

export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" />
    <path d="M10 11v6M14 11v6" />
  </Base>
);

export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.62.79 1.05 1.44 1.05H21a2 2 0 0 1 0 4h-.09c-.65 0-1.24.43-1.51 1Z" />
  </Base>
);

export const IconChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m9 18 6-6-6-6" />
  </Base>
);

export const IconArrowLeft = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </Base>
);

export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);

export const IconMore = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </Base>
);

export const IconPin = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 17v5M9 10.8V4h6v6.8l2 3.2H7l2-3.2Z" />
  </Base>
);

export const IconBook = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z" />
    <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
  </Base>
);

export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Base>
);

export const IconImage = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-4.5-4.5L5 21" />
  </Base>
);

export const IconBold = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M6 4h7a4 4 0 0 1 0 8H6zM6 12h8a4 4 0 0 1 0 8H6z" />
  </Base>
);

export const IconItalic = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M19 4h-9M14 20H5M15 4 9 20" />
  </Base>
);

export const IconUnderline = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M6 4v6a6 6 0 0 0 12 0V4M4 21h16" />
  </Base>
);

export const IconStrike = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 12h16M17.5 7A4 4 0 0 0 14 5h-4a3.5 3.5 0 0 0-1.5 6.5M7 17a3.5 3.5 0 0 0 3 2h4a4 4 0 0 0 3.5-2" />
  </Base>
);

export const IconH1 = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 6v12M12 6v12M4 12h8M17 18V9l-2 1.5" />
  </Base>
);

export const IconH2 = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 6v12M11 6v12M4 12h7M15 10a2 2 0 1 1 3.6 1.2L15 18h5" />
  </Base>
);

export const IconH3 = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 6v12M11 6v12M4 12h7M15 9a2 2 0 1 1 3 2 2 2 0 1 1-3 2" />
  </Base>
);

export const IconList = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Base>
);

export const IconListOrdered = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4l2-2.5V15a1 1 0 0 0-2 0" />
  </Base>
);

export const IconCheckSquare = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m9 11 3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </Base>
);

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Base>
);

export const IconQuote = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3 21c3 0 7-1 7-8V5H3v7h4M14 21c3 0 7-1 7-8V5h-7v7h4" />
  </Base>
);

export const IconCode = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
  </Base>
);

export const IconLink = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
  </Base>
);

export const IconUndo = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />
  </Base>
);

export const IconRedo = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />
  </Base>
);

export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </Base>
);

export const IconMenu = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Base>
);

export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Base>
);

export const IconRestore = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
  </Base>
);

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </Base>
);

export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18M8 2v4M16 2v4" />
  </Base>
);

// Lucide „rocket“ — optično uravnana pot iz lucide.dev.
export const IconRocket = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </Base>
);

// Lucide „flame“
export const IconFlame = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </Base>
);

// Lucide „trending-up“
export const IconTrendingUp = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M16 7h6v6" />
    <path d="m22 7-8.5 8.5-5-5L2 17" />
  </Base>
);

// Lucide „trophy“ — poenostavljena pot.
export const IconTrophy = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <path d="M8 5H4v1a4 4 0 0 0 4 4M16 5h4v1a4 4 0 0 1-4 4" />
    <path d="M12 13v4M9 21h6M10 17h4v4h-4z" />
  </Base>
);

// Lucide „users“
export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Base>
);

export const IconBasket = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m15 11-1 9" />
    <path d="m19 11-4-7" />
    <path d="M2 11h20" />
    <path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" />
    <path d="M4.5 15.5h15" />
    <path d="m5 11 4-7" />
    <path d="m9 11 1 9" />
  </Base>
);

export const IconStore = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
    <path d="M2 7h20" />
    <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
  </Base>
);

export const IconCopy = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Base>
);

export const IconArrowUp = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m5 12 7-7 7 7M12 19V5" />
  </Base>
);

export const IconArrowDown = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </Base>
);

export const IconPencil = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" />
    <path d="m15 5 4 4" />
  </Base>
);

export const IconHandshake = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m11 17 2 2a1 1 0 1 0 3-3" />
    <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
    <path d="m21 3 1 11h-2" />
    <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
    <path d="M3 4h8" />
  </Base>
);

export const IconChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m15 18-6-6 6-6" />
  </Base>
);

export const IconHistory = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </Base>
);

export const IconHandCoins = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
    <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
    <path d="m2 16 6 6" />
    <circle cx="16" cy="9" r="2.9" />
    <circle cx="6" cy="5" r="3" />
  </Base>
);

export const IconCar = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" />
    <path d="M9 17h6" />
    <circle cx="17" cy="17" r="2" />
  </Base>
);

export const IconWrench = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </Base>
);

export const IconHammer = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9" />
    <path d="m18 15 4-4" />
    <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-1.13a6 6 0 0 0-2.648-.62H12l.88.88a2 2 0 0 1 .52 1.85L13 9l.6.6" />
  </Base>
);

export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </Base>
);

export const IconGrid = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </Base>
);

export const IconTally = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 4v16M9 4v16M14 4v16M19 4v16M22 6 2 18" />
  </Base>
);

export const IconShuffle = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="m18 14 4 4-4 4" />
    <path d="m18 2 4 4-4 4" />
    <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-7.6a4 4 0 0 1 3.3-1.7H22" />
    <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2" />
    <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
  </Base>
);
