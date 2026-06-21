import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, LogOut, PlusCircle, Search } from "lucide-react";
import { getCurrentUser, permissionsFor } from "@/lib/auth";
import { permissions } from "@/lib/constants";
import { logoutAction } from "@/lib/actions";
import { SideNav, type NavIcon } from "./side-nav";
import { SystemClock } from "./system-clock";

const primaryNav: [string, string, NavIcon, string][] = [
  ["Dashboard", "/dashboard", "dashboard", permissions.dashboard],
  ["Leads", "/leads", "leads", permissions.leadsRead],
  ["Clients", "/clients", "clients", permissions.clientsRead],
  ["Quotes", "/quotes", "quotes", permissions.quotesRead],
  ["Projects", "/projects", "projects", permissions.projectsRead],
  ["Tasks", "/tasks", "tasks", permissions.tasksRead],
  ["Calendar", "/calendar", "calendar", permissions.tasksRead],
  ["Finance", "/billing", "finance", permissions.billingRead],
  ["Payroll", "/payroll", "payroll", permissions.payrollRead],
  ["Support", "/support", "support", permissions.supportRead],
  ["Marketing", "/marketing", "marketing", permissions.marketingRead],
];

const adminNav: [string, string, NavIcon, string][] = [["Settings", "/settings", "settings", permissions.settingsManage]];

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const roleName = user.role?.name ?? "No role assigned";
  const userPermissions = permissionsFor(user);
  const toItems = (rows: [string, string, NavIcon, string][]) =>
    rows
      .filter(([, , , permission]) => userPermissions.includes(permission))
      .map(([label, href, icon]) => ({ label, href, icon }));
  const initials = user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "RR";

  return (
    <div className="min-h-screen text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-white/10 bg-slate-950/70 backdrop-blur-xl xl:flex">
        <div className="flex h-full flex-col p-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="rr-action grid size-11 place-items-center rounded-2xl text-sm font-black tracking-tight text-white">RR</div>
            <div>
              <p className="font-bold text-white">Rapid Rise OS</p>
              <p className="flex items-center gap-1.5 text-[0.65rem] text-slate-400">
                <span className="rr-dot !size-1.5" /> Command center · online
              </p>
            </div>
          </Link>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <Link href="/leads/new" className="flex items-center justify-center gap-2 rounded-xl border border-rapid-cyan/30 bg-rapid-cyan/10 px-3 py-2 text-xs font-semibold text-rapid-cyan transition hover:bg-rapid-cyan/15">
              <PlusCircle className="size-3.5" /> Lead
            </Link>
            <Link href="/tasks" className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">
              <ClipboardCheck className="size-3.5" /> Task
            </Link>
          </div>

          <div className="-mr-2 grow overflow-y-auto pr-2">
            <SideNav main={toItems(primaryNav)} admin={toItems(adminNav)} />
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-rapid-cyan/30 bg-rapid-cyan/10 text-xs font-bold text-rapid-cyan">{initials}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="truncate text-[0.7rem] text-slate-400">{roleName}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="xl:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/65 px-6 py-3.5 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard" className="hidden min-w-[24rem] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-400 transition hover:border-rapid-cyan/40 hover:text-white md:flex">
              <Search className="size-4 text-rapid-cyan" /> Quick access: dashboard search and reports
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <SystemClock />
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{user.name}</p>
                <p className="text-xs text-slate-400">{roleName}</p>
              </div>
              <form action={logoutAction}>
                <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-200">
                  <LogOut className="size-3.5" /> Logout
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="page-transition-in mx-auto max-w-[1500px] px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
