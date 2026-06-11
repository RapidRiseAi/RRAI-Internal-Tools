import { AppShell } from "@/components/app-shell";
import { LeadForm } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
export default async function NewLeadPage(){ const users=await prisma.user.findMany({where:{status:"ACTIVE"},select:{id:true,name:true}}); return <AppShell><PageHeader title="Create lead" eyebrow="CRM" description="Required fields are validated server-side before the lead is saved."/><Card><LeadForm users={users}/></Card></AppShell>; }
