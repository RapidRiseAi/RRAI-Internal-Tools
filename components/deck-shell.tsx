"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Gauge,
  Headset,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Search,
  Settings,
  Target,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { logoutAction } from "@/lib/actions";

export type DeckNavItem = { label: string; href: string; iconKey: string };
export type DeckNotification = { id: string; title: string; body: string; status: string; created_at: string };

const iconMap: Record<string, LucideIcon> = {
  dashboard: Gauge,
  myPanel: LayoutDashboard,
  messages: MessageSquare,
  leads: Target,
  clients: Building2,
  quotes: FileText,
  projects: BriefcaseBusiness,
  tasks: ClipboardCheck,
  calendar: CalendarDays,
  finance: CircleDollarSign,
  payroll: UsersRound,
  support: Headset,
  marketing: Megaphone,
  settings: Settings,
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "RR";
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!now) return <span className="font-mono text-xs text-deck-muted">—</span>;
  const date = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase();
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <span className="hidden font-mono text-xs text-deck-muted lg:inline">
      <span className="text-deck-text">{date}</span> {time}
    </span>
  );
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function NavLink({ item, collapsed }: { item: DeckNavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const Icon = iconMap[item.iconKey] ?? Gauge;
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={clsx(
        "group relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition",
        collapsed ? "justify-center px-2" : "px-3",
        active ? "bg-white/[0.04] text-deck-text" : "text-deck-muted hover:bg-white/[0.03] hover:text-deck-text",
      )}
    >
      <span className={clsx("absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full bg-accent-cyan transition-all", active ? "w-[3px] shadow-[0_0_10px_rgba(70,232,209,0.8)]" : "w-0")} />
      <Icon className={clsx("size-4 shrink-0", active ? "text-accent-cyan" : "text-deck-muted group-hover:text-accent-cyan")} />
      {collapsed ? null : <span className="truncate">{item.label}</span>}
    </Link>
  );
}

export function DeckShell({
  user,
  primaryNav,
  adminNav,
  notifications,
  unreadCount,
  children,
}: {
  user: { name: string; role: string };
  primaryNav: DeckNavItem[];
  adminNav: DeckNavItem[];
  notifications: DeckNotification[];
  unreadCount: number;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState<null | "bell" | "user">(null);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("deck-sidebar-collapsed") === "1");
  }, []);
  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("deck-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="min-h-screen text-deck-text">
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-hairline bg-deck-panel/70 backdrop-blur-md transition-[width] duration-200 xl:flex",
          collapsed ? "w-[4.75rem] px-2 py-5" : "w-64 px-4 py-5",
        )}
      >
        <Link href="/dashboard" className={clsx("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent-copper to-accent-cyan font-display text-sm font-black text-deck-bg">RR</div>
          {collapsed ? null : (
            <div>
              <p className="font-display font-bold text-deck-text">Rapid Rise OS</p>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-deck-muted">Command deck</p>
            </div>
          )}
        </Link>

        {collapsed ? (
          <div className="mt-6 grid gap-2">
            <Link href="/leads/new" title="New lead" className="grid place-items-center rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 py-2 text-accent-cyan transition hover:bg-accent-cyan/15"><PlusCircle className="size-4" /></Link>
            <Link href="/tasks" title="Tasks" className="grid place-items-center rounded-lg border border-hairline bg-white/[0.03] py-2 text-deck-muted transition hover:text-deck-text"><ClipboardCheck className="size-4" /></Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Link href="/leads/new" className="flex items-center justify-center gap-2 rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-2 text-xs font-semibold text-accent-cyan transition hover:bg-accent-cyan/15"><PlusCircle className="size-3.5" /> Lead</Link>
            <Link href="/tasks" className="flex items-center justify-center gap-2 rounded-lg border border-hairline bg-white/[0.03] px-3 py-2 text-xs font-semibold text-deck-muted transition hover:text-deck-text"><ClipboardCheck className="size-3.5" /> Task</Link>
          </div>
        )}

        {collapsed ? null : <p className="mt-6 px-3 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-deck-muted/70">Main</p>}
        <nav className="mt-2 grid gap-1">
          {primaryNav.map((item) => <NavLink key={item.href} item={item} collapsed={collapsed} />)}
        </nav>

        {adminNav.length ? (
          <>
            {collapsed ? <div className="mx-auto my-3 h-px w-8 bg-hairline" /> : <p className="mt-6 px-3 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-deck-muted/70">Admin</p>}
            <nav className="mt-2 grid gap-1">
              {adminNav.map((item) => <NavLink key={item.href} item={item} collapsed={collapsed} />)}
            </nav>
          </>
        ) : null}

        <button
          type="button"
          onClick={toggleCollapsed}
          className={clsx("mt-auto flex items-center gap-2 rounded-lg border border-hairline bg-white/[0.02] py-2 text-xs font-semibold text-deck-muted transition hover:text-deck-text", collapsed ? "justify-center px-2" : "px-3")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Collapse</>}
        </button>
      </aside>

      <div className={clsx("flex h-screen flex-col transition-[padding] duration-200", collapsed ? "xl:pl-[4.75rem]" : "xl:pl-64")}>
        <header className="relative z-[100] shrink-0 border-b border-hairline bg-deck-bg/80 px-4 py-3 backdrop-blur-md md:px-6">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="hidden min-w-[20rem] items-center gap-3 rounded-lg border border-hairline bg-white/[0.03] px-4 py-2 text-sm text-deck-muted transition hover:border-accent-cyan/40 hover:text-deck-text md:flex md:max-w-md md:flex-1">
              <Search className="size-4 text-accent-cyan" />
              <span className="truncate">Search tasks, projects, clients…</span>
            </Link>

            <div className="ml-auto flex items-center gap-2 md:gap-3">
              <span className="hidden items-center gap-2 rounded-full border border-pos/30 bg-pos/10 px-3 py-1.5 sm:inline-flex">
                <span className="size-2 rounded-full bg-pos deck-live-dot" />
                <span className="font-display text-[0.65rem] font-bold uppercase tracking-[0.2em] text-pos">Live</span>
              </span>

              <LiveClock />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu((prev) => (prev === "bell" ? null : "bell"))}
                  className="relative grid size-9 place-items-center rounded-lg border border-hairline bg-white/[0.03] text-deck-muted transition hover:text-deck-text"
                  aria-label="Notifications"
                >
                  <Bell className="size-4" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 grid min-w-[1.1rem] place-items-center rounded-full bg-accent-cyan px-1 font-mono text-[0.6rem] font-bold text-deck-bg">{unreadCount > 99 ? "99+" : unreadCount}</span>
                  ) : null}
                </button>
                {openMenu === "bell" ? (
                  <DropdownPanel onClose={() => setOpenMenu(null)}>
                    <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
                      <p className="font-display text-sm font-semibold text-deck-text">Notifications</p>
                      <span className="font-mono text-xs text-deck-muted">{unreadCount} unread</span>
                    </div>
                    <div className="max-h-80 overflow-auto">
                      {notifications.length ? notifications.map((note) => (
                        <div key={note.id} className="flex gap-3 border-b border-hairline px-4 py-3 last:border-b-0">
                          <span className={clsx("mt-1.5 size-2 shrink-0 rounded-full", note.status === "UNREAD" ? "bg-accent-cyan" : "bg-hairline")} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-deck-text">{note.title}</p>
                            <p className="line-clamp-2 text-xs text-deck-muted">{note.body}</p>
                            <p className="mt-1 font-mono text-[0.65rem] text-deck-muted">{relativeTime(note.created_at)}</p>
                          </div>
                        </div>
                      )) : <p className="px-4 py-8 text-center text-sm text-deck-muted">No notifications.</p>}
                    </div>
                  </DropdownPanel>
                ) : null}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu((prev) => (prev === "user" ? null : "user"))}
                  className="flex items-center gap-2 rounded-lg border border-hairline bg-white/[0.03] py-1 pl-1 pr-2 transition hover:border-accent-cyan/40"
                >
                  <span className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-accent-copper to-accent-cyan font-mono text-xs font-bold text-deck-bg">{initials(user.name)}</span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-xs font-semibold leading-tight text-deck-text">{user.name}</span>
                    <span className="block font-mono text-[0.6rem] uppercase tracking-wider text-deck-muted">{user.role}</span>
                  </span>
                  <ChevronRight className="hidden size-3.5 rotate-90 text-deck-muted sm:block" />
                </button>
                {openMenu === "user" ? (
                  <DropdownPanel onClose={() => setOpenMenu(null)} align="right" width="w-56">
                    <div className="border-b border-hairline px-4 py-3">
                      <p className="text-sm font-semibold text-deck-text">{user.name}</p>
                      <p className="font-mono text-xs text-deck-muted">{user.role}</p>
                    </div>
                    <Link href="/settings" className="flex items-center gap-2 px-4 py-2.5 text-sm text-deck-muted transition hover:bg-white/[0.03] hover:text-deck-text"><Settings className="size-4" /> Settings</Link>
                    <form action={logoutAction}>
                      <button type="submit" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-deck-muted transition hover:bg-white/[0.03] hover:text-neg"><LogOut className="size-4" /> Logout</button>
                    </form>
                  </DropdownPanel>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="page-transition-in flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}

function DropdownPanel({ children, onClose, align = "right", width = "w-80" }: { children: React.ReactNode; onClose: () => void; align?: "left" | "right"; width?: string }) {
  return (
    <>
      <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-[900] cursor-default" onClick={onClose} />
      <div className={clsx("absolute top-full z-[1000] mt-2 overflow-hidden rounded-xl border border-hairline bg-deck-panel shadow-2xl shadow-black/50", width, align === "right" ? "right-0" : "left-0")}>
        {children}
      </div>
    </>
  );
}
