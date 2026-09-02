// Admin shell: collapsible navy sidebar + sticky topbar with breadcrumb, search,
// notifications and the admin profile menu. Renders unconditionally — never gated on a fetch.
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Shield,
  Sparkles,
  UserCog,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV_GROUPS, NAV_ITEMS, navItemForPath } from "@/components/admin/nav";
import { apiGet } from "@/lib/api";
import { fmtRelative, initials } from "@/lib/format";
import { endSession, fetchMe, ME_KEY } from "@/lib/session";
import type { AppNotification, PageResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "gmo-admin-sidebar-collapsed";

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const { data: admin } = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, retry: false });
  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => apiGet<PageResult<AppNotification>>("/notifications?read=false&page_size=5"),
    retry: false,
  });

  const active = navItemForPath(location.pathname);
  const segments = location.pathname.split("/").filter(Boolean);
  const isDetail = segments.length > 1;

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const term = search.trim();
    if (!term) return;
    navigate(`/customers?q=${encodeURIComponent(term)}`);
  };

  const signOut = async () => {
    await endSession();
    navigate("/login", { replace: true });
  };

  const nav = (
    <nav className="flex-1 overflow-y-auto px-2 py-3" data-testid="sidebar-nav">
      {NAV_GROUPS.map((group) => {
        const items = NAV_ITEMS.filter((item) => item.group === group);
        return (
          <div key={group} className="mb-3">
            {!collapsed ? (
              <p className="eyebrow px-2 pb-1.5 text-[10px] text-slate-500">{group}</p>
            ) : (
              <div className="mx-2 mb-2 border-t border-white/10" />
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = active?.path === item.path;
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      data-testid={`nav-${item.short.toLowerCase()}`}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium transition-colors duration-150",
                        collapsed && "justify-center px-0",
                        isActive
                          ? "bg-nav-active text-white"
                          : "text-slate-300 hover:bg-nav-hover hover:text-white",
                      )}
                    >
                      {isActive ? (
                        <span className="absolute top-1.5 bottom-1.5 -left-2 w-[3px] rounded-r bg-blue-400" />
                      ) : null}
                      <Icon className={cn("size-4 shrink-0", isActive && "text-blue-300")} />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col bg-nav text-nav-foreground transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[248px]",
      )}
      data-testid="admin-sidebar"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-3",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-blue-600 text-white">
          <Sparkles className="size-4" />
        </span>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm leading-tight font-bold text-white">GlowMeOut</p>
            <p className="truncate text-[10px] tracking-wider text-slate-400 uppercase">
              Operations Console
            </p>
          </div>
        ) : null}
      </div>

      {nav}

      <div className="shrink-0 border-t border-white/10 p-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          data-testid="sidebar-collapse-toggle"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium text-slate-300 transition-colors duration-150 hover:bg-nav-hover hover:text-white",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <>
              <PanelLeftClose className="size-4" /> Collapse
            </>
          )}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block">{sidebar}</div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden" data-testid="mobile-sidebar">
          <div className="animate-fade h-full">{sidebar}</div>
          <button
            type="button"
            aria-label="Close navigation"
            data-testid="mobile-sidebar-backdrop"
            onClick={() => setMobileOpen(false)}
            className="flex-1 bg-slate-900/50"
          >
            <X className="mt-4 ml-4 size-5 text-white" />
          </button>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-grid bg-card/95 px-4 backdrop-blur"
          data-testid="admin-topbar"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            data-testid="mobile-menu-button"
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>

          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-[13px]"
            data-testid="breadcrumb"
          >
            <Link
              to="/dashboard"
              className="text-slate-500 transition-colors duration-150 hover:text-primary"
              data-testid="breadcrumb-home"
            >
              Home
            </Link>
            {active ? (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-slate-300" />
                <Link
                  to={active.path}
                  className={cn(
                    "truncate transition-colors duration-150",
                    isDetail
                      ? "text-slate-500 hover:text-primary"
                      : "font-semibold text-slate-800",
                  )}
                  data-testid="breadcrumb-section"
                >
                  {active.label}
                </Link>
              </>
            ) : null}
            {isDetail ? (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-slate-300" />
                <span
                  className="truncate font-semibold text-slate-800"
                  data-testid="breadcrumb-detail"
                >
                  Record detail
                </span>
              </>
            ) : null}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <form onSubmit={submitSearch} className="hidden md:block" data-testid="global-search-form">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search customers, partners, bookings"
                  data-testid="global-search-input"
                  className="h-8 w-72 bg-background pl-8 text-xs"
                />
              </div>
            </form>

            <Link
              to="/notifications"
              data-testid="topbar-notifications"
              aria-label="Notifications"
              className="relative grid size-8 place-items-center rounded-md text-slate-500 transition-colors duration-150 hover:bg-secondary hover:text-slate-800"
            >
              <Bell className="size-4" />
              {unread && unread.total > 0 ? (
                <span
                  className="num absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
                  data-testid="topbar-notifications-badge"
                >
                  {unread.total}
                </span>
              ) : null}
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger
                data-testid="admin-profile-trigger"
                className="flex items-center gap-2 rounded-md py-1 pr-2 pl-1 transition-colors duration-150 hover:bg-secondary"
              >
                <span className="grid size-7 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {initials(admin?.name ?? "GA")}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-[9rem] truncate text-xs font-semibold text-slate-800">
                    {admin?.name ?? "Administrator"}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {admin?.role ?? "Signed in"}
                  </span>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-800">{admin?.name ?? "Administrator"}</p>
                  <p className="text-[11px] font-normal text-slate-500">{admin?.email ?? "—"}</p>
                  <p className="text-[11px] font-normal text-slate-500">
                    Last sign-in {fmtRelative(admin?.last_login)}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate("/settings")}
                  data-testid="profile-menu-settings"
                >
                  <UserCog className="size-4" /> Admin profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/settings?tab=security")}
                  data-testid="profile-menu-security"
                >
                  <Shield className="size-4" /> Security
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={signOut}
                  data-testid="profile-menu-signout"
                >
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          className="scroll-slim flex-1 overflow-y-auto px-4 py-5 lg:px-6"
          data-testid="admin-main"
        >
          <div className="animate-fade mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
