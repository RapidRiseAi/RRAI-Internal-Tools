import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { prisma } from "@/lib/db";
import { money } from "@/lib/format";
export default async function Services(){const services=await prisma.service.findMany({include:{packages:true,templates:true},orderBy:{name:"asc"}}); return <AppShell><ModulePage eyebrow="Catalogue" title="Services & packages" description="Central Rapid Rise AI service catalogue with default pricing, packages, add-ons and checklist-template links." metrics={[["Services",services.length],["Active",services.filter(s=>s.isActive).length],["Packages",services.reduce((a,s)=>a+s.packages.length,0)],["Templates",services.reduce((a,s)=>a+s.templates.length,0)],["Base MRR",money(services.reduce((a,s)=>a+s.baseMonthlyCents,0))]]} records={services.map(s=>({id:s.id,title:s.name,subtitle:s.description,status:s.isActive?"ACTIVE":"INACTIVE",value:money(s.baseOnceOffCents)}))} emptyTitle="No services yet"/></AppShell>}
