import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, BriefcaseBusiness, Building2, CircleDollarSign, ClipboardCheck, FileText, Gauge, Handshake, Headset, Library, Megaphone, Settings, Shield, Target, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";

const nav = [
  ["Dashboard", "/dashboard", Gauge],
  ["Leads", "/leads", Target],
  ["Clients", "/clients", Building2],
  ["Quotes", "/quotes", FileText],
  ["Projects", "/projects", BriefcaseBusiness],
  ["Tasks", "/tasks", ClipboardCheck],
  ["Billing", "/billing", CircleDollarSign],
  ["Retainers", "/retainers", Shield],
  ["Support", "/support", Headset],
  ["Affiliates", "/affiliates", Handshake],
  ["Marketing", "/marketing", Megaphone],
  ["Knowledge Base", "/knowledge-base", Library],
  ["Reports", "/reports", BarChart3],
  ["Settings", "/settings", Settings],
] as const;

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <div className="min-h-screen bg-slate-950/40 text-slate-100"><aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-white/10 bg-slate-950/90 p-5 backdrop-blur xl:block"><Link href="/dashboard" className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-rapid-blue to-rapid-cyan font-black">RR</div><div><p className="font-bold text-white">Rapid Rise OS</p><p className="text-xs text-slate-400">Internal command center</p></div></Link><nav className="mt-8 grid gap-1">{nav.map(([label, href, Icon]) => <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/8 hover:text-white"><Icon className="size-4 text-slate-500 group-hover:text-rapid-cyan" />{label}</Link>)}</nav></aside><div className="xl:pl-72"><header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 px-6 py-4 backdrop-blur"><div className="flex items-center justify-between gap-4"><div className="hidden min-w-[28rem] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-500 md:block">Search leads, clients, projects, quotes and tasks…</div><div className="ml-auto flex items-center gap-3"><div className="text-right"><p className="text-sm font-semibold text-white">{user.name}</p><p className="text-xs text-slate-400">{user.role.name}</p></div><form action={logoutAction}><button className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">Logout</button></form></div></div></header><main className="mx-auto max-w-[1500px] px-6 py-8">{children}</main></div></div>;
}
