// Navigation manifest — the single source for the sidebar and breadcrumb labels.
import {
  BarChart3,
  Bell,
  Briefcase,
  CalendarCheck,
  CreditCard,
  Headphones,
  LayoutDashboard,
  Scissors,
  ScrollText,
  Settings,
  ShieldCheck,
  Star,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  short: string;
  path: string;
  icon: LucideIcon;
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", short: "Dashboard", path: "/dashboard", icon: LayoutDashboard, group: "Overview" },
  { label: "Customers", short: "Customers", path: "/customers", icon: Users, group: "Marketplace" },
  { label: "Partners", short: "Partners", path: "/partners", icon: Briefcase, group: "Marketplace" },
  {
    label: "Partner Verification",
    short: "Verification",
    path: "/partner-verification",
    icon: ShieldCheck,
    group: "Marketplace",
  },
  { label: "Services", short: "Services", path: "/services", icon: Scissors, group: "Marketplace" },
  { label: "Bookings", short: "Bookings", path: "/bookings", icon: CalendarCheck, group: "Operations" },
  { label: "Payments", short: "Payments", path: "/payments", icon: CreditCard, group: "Operations" },
  { label: "Reviews", short: "Reviews", path: "/reviews", icon: Star, group: "Operations" },
  {
    label: "Support & Disputes",
    short: "Support",
    path: "/support",
    icon: Headphones,
    group: "Operations",
  },
  { label: "Offers & Coupons", short: "Offers", path: "/offers", icon: Tag, group: "Growth" },
  { label: "Analytics", short: "Analytics", path: "/analytics", icon: BarChart3, group: "Growth" },
  {
    label: "Notifications",
    short: "Notifications",
    path: "/notifications",
    icon: Bell,
    group: "Administration",
  },
  { label: "Audit Log", short: "Audit", path: "/audit", icon: ScrollText, group: "Administration" },
  { label: "Settings", short: "Settings", path: "/settings", icon: Settings, group: "Administration" },
];

export const NAV_GROUPS = ["Overview", "Marketplace", "Operations", "Growth", "Administration"];

export function navItemForPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
}
