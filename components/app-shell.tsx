import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefcaseBusiness, Building2, CalendarDays, CircleDollarSign, ClipboardCheck, FileText, Gauge, Headset, Megaphone, PlusCircle, Search, Settings, Target, UsersRound } from "lucide-react";
import { getCurrentUser, permissionsFor } from "@/lib/auth";
import { permissions } from "@/lib/constants";
import { logoutAction } from "@/lib/actions";

const primaryNav = [
  ["Dashboard", "/dashboard", Gauge, permissions.dashboard],
  ["Leads", "/leads", Target, permissions.leadsRead],
  ["Clients", "/clients", Building2, permissions.clientsRead],
  ["Quotes", "/quotes", FileText, permissions.quotesRead],
  ["Projects", "/projects", BriefcaseBusiness, permissions.projectsRead],
  ["Tasks", "/tasks", ClipboardCheck, permissions.tasksRead],
  ["Calendar", "/calendar", CalendarDays, permissions.tasksRead],
  ["Finance", "/billing", CircleDollarSign, permissions.billingRead],
  ["Payroll", "/payroll", UsersRound, permissions.payrollRead],
  ["Support", "/support", Headset, permissions.supportRead],
  ["Marketing", "/marketing", Megaphone, permissions.marketingRead],
] as const;

const adminNav = [["Settings", "/settings", Settings, permissions.settingsManage]] as const;

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const roleName = user.role?.name ?? "No role assigned";
  const userPermissions = permissionsFor(user);

  return (
    <div className="min-h-screen bg-slate-950/40 text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-slate-950/90 p-5 backdrop-blur xl:block">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-rapid-blue to-rapid-cyan font-black">RR</div>
          <div>
            <p className="font-bold text-white">Rapid Rise OS</p>
            <p className="text-xs text-slate-400">Simple command center</p>
          </div>
        </Link>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Link href="/leads/new" className="flex items-center justify-center gap-2 rounded-xl border border-rapid-cyan/30 bg-rapid-cyan/10 px-3 py-2 text-xs font-semibold text-rapid-cyan hover:bg-rapid-cyan/15"><PlusCircle className="size-3.5" /> Lead</Link>
          <Link href="/tasks" className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"><ClipboardCheck className="size-3.5" /> Task</Link>
        </div>
        <p className="mt-5 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-slate-500">Main</p>
        <nav className="mt-2 grid gap-1">
          {primaryNav.filter(([, , , permission]) => userPermissions.includes(permission)).map(([label, href, Icon]) => (
            <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/8 hover:text-white">
              <Icon className="size-4 text-slate-500 group-hover:text-rapid-cyan" />
              {label}
            </Link>
          ))}
        </nav>
        {adminNav.some(([, , , permission]) => userPermissions.includes(permission)) ? <><p className="mt-5 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-slate-500">Admin</p><nav className="mt-2 grid gap-1">{adminNav.filter(([, , , permission]) => userPermissions.includes(permission)).map(([label, href, Icon]) => <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/8 hover:text-white"><Icon className="size-4 text-slate-500 group-hover:text-rapid-cyan" />{label}</Link>)}</nav></> : null}
      </aside>
      <div className="xl:pl-64">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 px-6 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard" className="hidden min-w-[28rem] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-400 transition hover:border-rapid-cyan/40 hover:text-white md:flex"><Search className="size-4 text-rapid-cyan" /> Quick access: dashboard search and reports</Link>
            <div className="ml-auto flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{user.name}</p>
                <p className="text-xs text-slate-400">{roleName}</p>
              </div>
              <form action={logoutAction}>
                <button className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">Logout</button>
              </form>
            </div>
          </div>
        </header>
        <main className="page-transition-in mx-auto max-w-[1500px] px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
