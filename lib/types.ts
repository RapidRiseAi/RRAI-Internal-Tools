export type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  password_hash?: string;
  role_id: string;
  role?: Role;
  status: "ACTIVE" | "INACTIVE";
  employment_type: string;
  department: string | null;
  specialties: string | null;
  pay_type: string;
  pay_rate_cents: number;
  start_date: string | null;
  emergency_contact: string | null;
  employee_notes: string | null;
  title: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  source: string;
  service_interest: string;
  stage: string;
  score: number;
  follow_up_date: string | null;
  next_action: string | null;
  pain_points: string | null;
  lost_reason: string | null;
  assigned_to: string | null;
  created_by: string | null;
  converted_client_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Pick<User, "id" | "name"> | null;
};

export type Client = {
  id: string;
  company_name: string;
  account_status: string;
  industry: string | null;
  website: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  next_action: string | null;
  mrr_cents: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  client_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  due_date: string | null;
  client_id: string | null;
  project_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Pick<User, "id" | "name"> | null;
};

export type Service = {
  id: string;
  name: string;
  category: string;
  description: string;
  base_once_off_cents: number;
  base_monthly_cents: number;
  is_active: boolean;
};

export type Package = {
  id: string;
  service_id: string;
  name: string;
  description: string;
  once_off_cents: number;
  monthly_cents: number;
  is_active: boolean;
};

export type ActivityLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  message: string;
  actor_id: string | null;
  lead_id: string | null;
  client_id: string | null;
  quote_id: string | null;
  project_id: string | null;
  task_id: string | null;
  created_at: string;
};

export type Quote = {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  once_off_total_cents: number;
  monthly_total_cents: number;
  client_id: string | null;
  lead_id: string | null;
  valid_until: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  once_off_cents: number;
  monthly_cents: number;
  sort_order: number;
};

export type Project = {
  id: string;
  name: string;
  status: string;
  stage: string | null;
  priority: string;
  progress: number;
  blocker: string | null;
  deadline: string | null;
  client_id: string;
  quote_id: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export type ChecklistTemplate = { id: string; name: string; service_id: string | null; description: string | null; is_active: boolean; };
export type ChecklistItem = { id: string; template_id: string; title: string; description: string | null; sort_order: number; };
export type ProjectChecklist = { id: string; project_id: string; template_item_id: string | null; title: string; status: string; completed_at: string | null; created_at: string; updated_at: string; };
export type Note = { id: string; body: string; entity_type: string; entity_id: string; client_id: string | null; lead_id: string | null; project_id: string | null; created_at: string; updated_at: string; };
export type FileRecord = { id: string; filename: string; url: string; mime_type: string | null; entity_type: string; entity_id: string; client_id: string | null; lead_id: string | null; project_id: string | null; knowledge_base_item_id: string | null; created_at: string; updated_at: string; };
export type Invoice = { id: string; invoice_number: string; status: string; amount_cents: number; client_id: string; quote_id: string | null; due_date: string | null; issued_at: string | null; created_at: string; updated_at: string; };
export type InvoiceItem = { id: string; invoice_id: string; description: string; quantity: number; unit_amount_cents: number; sort_order: number; };
export type Payment = { id: string; invoice_id: string; amount_cents: number; status: string; paid_at: string | null; method: string | null; reference: string | null; created_at: string; updated_at: string; };
export type PayrollRun = { id: string; period_start: string; period_end: string; status: string; notes: string | null; created_by: string | null; created_at: string; updated_at: string; };
export type PayrollItem = { id: string; payroll_run_id: string; user_id: string; role_snapshot: string | null; pay_type: string; hours: number; gross_pay_cents: number; deductions_cents: number; net_pay_cents: number; notes: string | null; paid_at: string | null; created_at: string; user?: Pick<User, "id" | "name" | "title"> | null; };
export type Retainer = { id: string; type: string; status: string; monthly_amount_cents: number; client_id: string; next_billing_date: string | null; created_at: string; updated_at: string; };
export type Vendor = { id: string; name: string; category: string | null; contact_name: string | null; email: string | null; phone: string | null; website: string | null; notes: string | null; created_at: string; updated_at: string; };
export type Expense = { id: string; vendor: string; category: string; amount_cents: number; status: string; expense_date: string; recurrence: "NONE" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL"; next_due_date: string | null; notes: string | null; client_id: string | null; project_id: string | null; created_by: string | null; created_at: string; updated_at: string; };
export type SupportTicket = { id: string; title: string; category: string; priority: string; status: string; client_id: string | null; project_id: string | null; assigned_to: string | null; internal_notes: string | null; client_update_notes: string | null; resolution_notes: string | null; resolved_at: string | null; created_at: string; updated_at: string; };
export type Affiliate = { id: string; name: string; email: string; tracking_code: string; status: string; default_commission_type: string; default_commission_rate: number; created_at: string; updated_at: string; };
export type Referral = { id: string; affiliate_id: string; lead_id: string | null; client_id: string | null; status: string; created_at: string; updated_at: string; };
export type Commission = { id: string; affiliate_id: string; quote_id: string | null; project_id: string | null; payment_id: string | null; status: string; amount_cents: number; commission_type: string; paid_at: string | null; created_at: string; updated_at: string; };
export type Campaign = { id: string; name: string; platform: string; target_industry: string | null; offer_message: string | null; number_contacted: number; replies: number; calls_booked: number; quotes_sent: number; deals_closed: number; created_at: string; updated_at: string; };
export type ContentItem = { id: string; title: string; status: string; platform: string | null; post_url: string | null; performance_notes: string | null; leads_generated: number; created_at: string; updated_at: string; };
export type KnowledgeBaseItem = { id: string; title: string; category: string; body: string; visibility: string; created_at: string; updated_at: string; };
export type Notification = { id: string; title: string; body: string; user_id: string | null; status: string; created_at: string; updated_at: string; };

export type CompanySettings = { id: boolean; company_name: string; billing_email: string | null; bank_name: string | null; bank_account_name: string | null; bank_account_number: string | null; bank_branch_code: string | null; payment_terms: string | null; quote_footer: string | null; invoice_footer: string | null; updated_at: string; };
export type DocumentTemplate = { id: string; name: string; type: string; content: string; is_default: boolean; created_at: string; updated_at: string; };
