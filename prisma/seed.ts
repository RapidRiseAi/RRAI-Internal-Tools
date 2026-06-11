import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { coreServices, roleNames, rolePermissionMap } from "../lib/constants";

const prisma = new PrismaClient();

async function main() {
  for (const name of roleNames) {
    await prisma.role.upsert({
      where: { name },
      update: { permissions: rolePermissionMap[name] },
      create: { name, description: `${name} access profile for Rapid Rise OS.`, permissions: rolePermissionMap[name] },
    });
  }

  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: "Owner/Admin" } });
  const email = process.env.SEED_OWNER_EMAIL || "owner@rapidrise.ai";
  const password = process.env.SEED_OWNER_PASSWORD || "ChangeMe123!";
  await prisma.user.upsert({
    where: { email },
    update: { roleId: ownerRole.id, status: "ACTIVE" },
    create: {
      name: "Xander Blumenthal",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      roleId: ownerRole.id,
      title: "Founder / Owner",
    },
  });

  for (const [index, name] of coreServices.entries()) {
    await prisma.service.upsert({
      where: { name },
      update: {},
      create: {
        name,
        category: name.includes("AI") || name.includes("Automation") ? "AI & Automation" : name.includes("Website") || name.includes("Landing") ? "Web" : "Software",
        description: `Rapid Rise AI ${name.toLowerCase()} delivery service with quote, project and checklist support.`,
        baseOnceOffCents: 150000 + index * 25000,
        baseMonthlyCents: name.includes("Hosting") || name.includes("Maintenance") || name.includes("SEO") ? 15000 : 0,
      },
    });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const lead = await prisma.lead.upsert({
    where: { id: "seed-lead-rapid" },
    update: {},
    create: {
      id: "seed-lead-rapid",
      companyName: "Rapid Rise Demo Prospect",
      contactName: "Demo Decision Maker",
      email: "prospect@example.com",
      source: "Referral",
      serviceInterest: "Internal business systems",
      stage: "DISCOVERY_NEEDED",
      score: 82,
      followUpDate: new Date(),
      nextAction: "Book discovery call and confirm service scope.",
      painPoints: "Needs one place for leads, projects, retainers and support.",
      assignedToId: user.id,
      createdById: user.id,
    },
  });
  await prisma.activityLog.upsert({
    where: { id: "seed-activity-lead" },
    update: {},
    create: { id: "seed-activity-lead", action: "LEAD_CREATED", entityType: "Lead", entityId: lead.id, leadId: lead.id, actorId: user.id, message: `${lead.companyName} created from seed data.` },
  });
}

main().finally(async () => prisma.$disconnect());
