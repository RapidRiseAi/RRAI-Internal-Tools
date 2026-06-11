import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { genericList } from "@/lib/data";
import type { KnowledgeBaseItem } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Knowledge() { const items = await genericList<KnowledgeBaseItem>("knowledge_base_items"); return <AppShell><ModulePage eyebrow="Procedures" title="Knowledge base" description="SOPs, sales scripts, discovery questions, pricing rules, proposal templates, troubleshooting and handover guides." metrics={[["Articles", items.length], ["SOPs", items.filter((item) => item.category === "SOP").length], ["Sales", items.filter((item) => item.category === "Sales").length], ["Troubleshooting", items.filter((item) => item.category === "Troubleshooting").length], ["Internal", items.filter((item) => item.visibility === "INTERNAL").length]]} records={items.map((item) => ({ id: item.id, title: item.title, subtitle: item.category, status: item.visibility }))} emptyTitle="No knowledge base items yet" /></AppShell>; }
