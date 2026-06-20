export const roleNames = [
  "Owner/Admin",
  "Manager",
  "Sales",
  "Project Manager",
  "Developer/Designer",
  "Support",
  "Finance",
  "Affiliate/Partner",
  "Read-only",
] as const;

export const permissions = {
  dashboard: "dashboard:view",
  leadsRead: "leads:read",
  leadsWrite: "leads:write",
  clientsRead: "clients:read",
  clientsWrite: "clients:write",
  quotesRead: "quotes:read",
  quotesWrite: "quotes:write",
  projectsRead: "projects:read",
  projectsWrite: "projects:write",
  tasksRead: "tasks:read",
  tasksWrite: "tasks:write",
  billingRead: "billing:read",
  billingWrite: "billing:write",
  payrollRead: "payroll:read",
  payrollWrite: "payroll:write",
  supportRead: "support:read",
  supportWrite: "support:write",
  marketingRead: "marketing:read",
  marketingWrite: "marketing:write",
  settingsManage: "settings:manage",
} as const;

export const allPermissions = Object.values(permissions);

export const rolePermissionMap: Record<string, string[]> = {
  "Owner/Admin": allPermissions,
  Manager: allPermissions.filter((permission) => permission !== permissions.settingsManage),
  Sales: [permissions.dashboard, permissions.leadsRead, permissions.leadsWrite, permissions.clientsRead, permissions.quotesRead, permissions.quotesWrite, permissions.tasksRead, permissions.tasksWrite, permissions.marketingRead],
  "Project Manager": [permissions.dashboard, permissions.clientsRead, permissions.quotesRead, permissions.projectsRead, permissions.projectsWrite, permissions.tasksRead, permissions.tasksWrite, permissions.supportRead],
  "Developer/Designer": [permissions.dashboard, permissions.clientsRead, permissions.projectsRead, permissions.tasksRead, permissions.tasksWrite, permissions.supportRead],
  Support: [permissions.dashboard, permissions.clientsRead, permissions.projectsRead, permissions.tasksRead, permissions.tasksWrite, permissions.supportRead, permissions.supportWrite],
  Finance: [permissions.dashboard, permissions.clientsRead, permissions.quotesRead, permissions.billingRead, permissions.billingWrite, permissions.payrollRead, permissions.payrollWrite],
  "Affiliate/Partner": [permissions.dashboard],
  "Read-only": [permissions.dashboard, permissions.leadsRead, permissions.clientsRead, permissions.quotesRead, permissions.projectsRead, permissions.tasksRead, permissions.billingRead, permissions.payrollRead, permissions.supportRead, permissions.marketingRead],
};

export const leadStages = ["NEW_LEAD", "CONTACTED", "REPLIED", "DISCOVERY_NEEDED", "DISCOVERY_COMPLETED", "QUOTE_NEEDED", "QUOTE_SENT", "NEGOTIATING", "WON", "LOST", "FOLLOW_UP_LATER"] as const;
export const clientStatuses = ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] as const;
export const quoteStatuses = ["DRAFT", "SENT", "VIEWED", "FOLLOW_UP_DUE", "ACCEPTED", "REJECTED", "EXPIRED"] as const;
export const projectStatuses = ["NOT_STARTED", "WAITING_FOR_CLIENT_INFO", "PLANNING", "DESIGN", "DEVELOPMENT", "INTEGRATION", "TESTING", "CLIENT_REVIEW", "REVISIONS", "READY_TO_LAUNCH", "LAUNCHED", "MAINTENANCE", "COMPLETED"] as const;
export const taskStatuses = ["TO_DO", "IN_PROGRESS", "WAITING_FOR_CLIENT", "WAITING_INTERNALLY", "BLOCKED", "REVIEW_NEEDED", "DONE", "SCRAPPED"] as const;
export const taskTypes = ["SALES_FOLLOW_UP", "DISCOVERY_CALL", "QUOTE_PREPARATION", "DESIGN_TASK", "DEVELOPMENT_TASK", "INTEGRATION_TASK", "TESTING_TASK", "CLIENT_REVISION", "SUPPORT_TASK", "ADMIN_TASK", "BILLING_TASK", "CONTENT_TASK"] as const;
export const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const taskRecurrences = ["NONE", "WEEKLY", "MONTHLY"] as const;
export const invoiceStatuses = ["DRAFT", "SENT", "PART_PAID", "PAID", "OVERDUE", "REFUNDED", "CANCELLED"] as const;
export const paymentStatuses = ["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"] as const;
export const retainerStatuses = ["ACTIVE", "PAUSED", "CANCELLED", "OVERDUE", "TRIAL", "UPGRADE_PENDING"] as const;
export const ticketStatuses = ["NEW", "IN_REVIEW", "IN_PROGRESS", "WAITING_FOR_CLIENT", "RESOLVED", "CLOSED"] as const;
export const ticketCategories = ["BUG", "CHANGE_REQUEST", "QUESTION", "TRAINING", "HOSTING", "BILLING", "OTHER"] as const;
export const affiliateStatuses = ["ACTIVE", "PAUSED", "INACTIVE"] as const;
export const commissionStatuses = ["PENDING", "APPROVED", "PAYABLE", "PAID", "CANCELLED", "DISPUTED"] as const;
export const knowledgeCategories = ["SOP", "Sales", "Troubleshooting", "Handover", "Pricing", "Internal"] as const;
export const contentStatuses = ["IDEA", "DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
export const employmentTypes = ["FULL_TIME", "PART_TIME", "CONTRACTOR", "INTERN"] as const;
export const payTypes = ["SALARY", "HOURLY", "CONTRACT"] as const;
export const payrollStatuses = ["DRAFT", "APPROVED", "PAID", "CANCELLED"] as const;
export const documentTemplateTypes = ["QUOTE", "INVOICE", "PROPOSAL", "HANDOVER"] as const;

export const coreServices = [
  "Website development",
  "Website hosting and maintenance",
  "SEO",
  "AI ranking / AI search visibility",
  "Client portals",
  "Custom dashboards",
  "AI communication/support agents",
  "WhatsApp AI systems",
  "Workflow automations",
  "Custom software",
  "Internal business systems",
  "Integrations",
  "Landing pages",
  "QR menu systems",
  "Inspection systems",
  "Booking systems",
  "Reporting systems",
];

export function labelize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
