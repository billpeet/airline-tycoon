import {
  Compass,
  Globe2,
  Plane,
  Network,
  Wallet,
  Sparkles,
  Newspaper,
  Bell,
  type LucideIcon,
} from "lucide-react";

/**
 * Sidebar navigation. Each item carries an IATA-style three-letter code
 * that doubles as the abbreviated label in the collapsed rail.
 */
export type NavItem = {
  code: string;        // 3-letter IATA-style id
  name: string;        // full label
  href: string;
  icon: LucideIcon;
  description?: string;
};

export type NavGroup = {
  group: string;       // e.g. "Operations"
  items: NavItem[];
};

export const navigation: NavGroup[] = [
  {
    group: "Operations",
    items: [
      {
        code: "OPS",
        name: "Operations Centre",
        href: "/dashboard",
        icon: Compass,
        description: "Today’s board: cash, on-time, alerts.",
      },
      {
        code: "GLB",
        name: "World Map",
        href: "/globe",
        icon: Globe2,
        description: "Live route arcs across the globe.",
      },
    ],
  },
  {
    group: "Network",
    items: [
      {
        code: "FLT",
        name: "Fleet",
        href: "/fleet",
        icon: Plane,
        description: "Aircraft, cycles, maintenance.",
      },
      {
        code: "NET",
        name: "Routes",
        href: "/routes",
        icon: Network,
        description: "City pairs, fares, frequencies.",
      },
    ],
  },
  {
    group: "Boardroom",
    items: [
      {
        code: "FIN",
        name: "Finance",
        href: "/finance",
        icon: Wallet,
        description: "Cash, debt, equity, hedges.",
      },
      {
        code: "TEC",
        name: "Tech Tree",
        href: "/tech",
        icon: Sparkles,
        description: "Capabilities and specialisations.",
      },
    ],
  },
  {
    group: "Wire",
    items: [
      {
        code: "EVT",
        name: "Events",
        href: "/events",
        icon: Bell,
        description: "Decisions awaiting your call.",
      },
      {
        code: "NWS",
        name: "Newsroom",
        href: "/news",
        icon: Newspaper,
        description: "What happened while you were away.",
      },
    ],
  },
];
