export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'caller';
  active: boolean;
  created_at: string;
}

export interface Stage {
  id: number;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface CustomField {
  id: number;
  name: string;
  field_type: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox';
  options?: string[];
  required: boolean;
  position: number;
  created_at: string;
}

export interface EnrichmentData {
  enriched_at: string;
  website_status: string;
  services: string[];
  products: string[];
  clients: string[];
  focus: string;
  technologies: string[];
  team_info: string | null;
  founding_year: number | null;
  company_age: number | null;
  recent_events: string[];
  summary: string;
  suitability_score: number;
  suitability_reasons: string[];
}

export interface Lead {
  id: number;
  register_id?: string;
  name: string;
  legal_form?: string;
  zip?: string;
  city?: string;
  street?: string;
  phone?: string;
  email?: string;
  website?: string;
  nace_code?: string;
  business_purpose?: string;
  ceo_1?: string;
  ceo_2?: string;
  revenue_eur?: number;
  employee_count?: number;
  northdata_url?: string;
  stage_id?: number;
  stage_name?: string;
  stage_color?: string;
  assigned_to?: number;
  assigned_to_name?: string;
  custom_fields?: Record<string, any>;
  enrichment_data?: EnrichmentData;
  tags?: Tag[];
  notes?: Note[];
  reminders?: Reminder[];
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: number;
  lead_id: number;
  user_id: number;
  user_name: string;
  content: string;
  created_at: string;
}

export interface Reminder {
  id: number;
  lead_id: number;
  user_id: number;
  due_at: string;
  reason?: string;
  completed: boolean;
  created_at: string;
}

export interface Contact {
  id: number;
  lead_id: number;
  first_name: string;
  last_name: string;
  role?: string;
  email?: string;
  phone?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SavedFilter {
  id: number;
  user_id: number;
  name: string;
  search?: string;
  stage_id?: number;
  nace_code?: string;
  assigned_to?: number;
  tags?: string[];
  city?: string;
  zip?: string;
  min_score?: number;
  created_at: string;
  updated_at: string;
}
