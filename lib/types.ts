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

export type ActivityLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  message: string;
  actor_id: string | null;
  lead_id: string | null;
  client_id: string | null;
  task_id: string | null;
  created_at: string;
};

export type Quote = { id: string; quote_number: string; title: string; status: string; once_off_total_cents: number; monthly_total_cents: number; client_id: string | null; lead_id: string | null; updated_at: string; };
export type Project = { id: string; name: string; status: string; progress: number; blocker: string | null; client_id: string; updated_at: string; };
export type Invoice = { id: string; invoice_number: string; status: string; amount_cents: number; client_id: string; updated_at: string; };
export type Retainer = { id: string; type: string; status: string; monthly_amount_cents: number; client_id: string; updated_at: string; };
export type SupportTicket = { id: string; title: string; category: string; priority: string; status: string; client_id: string | null; project_id: string | null; updated_at: string; };
export type Affiliate = { id: string; name: string; email: string; tracking_code: string; status: string; updated_at: string; };
export type Campaign = { id: string; name: string; platform: string; number_contacted: number; replies: number; calls_booked: number; quotes_sent: number; deals_closed: number; updated_at: string; };
export type ContentItem = { id: string; title: string; status: string; platform: string | null; leads_generated: number; updated_at: string; };
export type KnowledgeBaseItem = { id: string; title: string; category: string; body: string; visibility: string; updated_at: string; };
