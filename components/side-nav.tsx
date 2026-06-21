"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Gauge,
  Headset,
  Megaphone,
  Settings,
  Target,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavIcon =
  | "dashboard"
  | "leads"
  | "clients"
  | "quotes"
  | "projects"
  | "tasks"
  | "calendar"
  | "finance"
  | "payroll"
  | "support"
  | "marketing"
  | "settings";

export type NavItem = { label: string; href: string; icon: NavIcon };

const iconMap: Record<NavIcon, LucideIcon> = {
  dashboard: Gauge,
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

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = iconMap[item.icon];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        active ? "rr-nav-active text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-white",
      )}
    >
      <span className={clsx("rr-nav-rail absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-gradient-to-b from-rapid-cyan to-rapid-blue transition-opacity", active ? "opacity-100" : "opacity-0")} />
      <Icon className={clsx("size-4 shrink-0 transition", active ? "text-rapid-cyan drop-shadow-[0_0_6px_rgba(56,213,255,0.8)]" : "text-slate-500 group-hover:text-rapid-cyan")} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function SideNav({ home, groups }: { home: NavItem | null; groups: { label: string; items: NavItem[] }[] }) {
  const pathname = usePathname();
  return (
    <>
      {home ? (
        <nav className="mt-6 grid gap-1">
          <NavRow item={home} active={isActive(pathname, home.href)} />
        </nav>
      ) : null}
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mt-6 px-3 text-[0.6rem] font-semibold text-slate-500 rr-hud">{group.label}</p>
          <nav className="mt-2 grid gap-1">
            {group.items.map((item) => (
              <NavRow key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </nav>
        </div>
      ))}
    </>
  );
}
