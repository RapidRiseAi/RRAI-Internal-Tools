import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, permissionsFor } from "@/lib/auth";
import { permissions } from "@/lib/constants";
import { notificationsForUser } from "@/lib/data";
import { DeckShell, type DeckNavItem } from "./deck-shell";

const primaryNav: [string, string, string, string][] = [
  ["Control Panel", "/dashboard", "dashboard", permissions.dashboard],
  ["My Panel", "/my-panel", "myPanel", permissions.dashboard],
  ["Messages", "/messages", "messages", permissions.dashboard],
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

const adminNav: [string, string, string, string][] = [["Settings", "/settings", "settings", permissions.settingsManage]];

function toNav(rows: [string, string, string, string][], allowed: string[]): DeckNavItem[] {
  return rows.filter(([, , , permission]) => allowed.includes(permission)).map(([label, href, iconKey]) => ({ label, href, iconKey }));
}

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const userPermissions = permissionsFor(user);
  const notifications = await notificationsForUser(user.id, 10);
  const unreadCount = notifications.filter((note) => note.status === "UNREAD").length;

  return (
    <DeckShell
      user={{ name: user.name, role: user.role?.name ?? "No role assigned" }}
      primaryNav={toNav(primaryNav, userPermissions)}
      adminNav={toNav(adminNav, userPermissions)}
      notifications={notifications.map((note) => ({ id: note.id, title: note.title, body: note.body, status: note.status, created_at: note.created_at }))}
      unreadCount={unreadCount}
    >
      {children}
    </DeckShell>
  );
}
