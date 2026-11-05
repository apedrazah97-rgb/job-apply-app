import { createClient } from '@supabase/supabase-js';

// Fallback prevents build crash during Next.js static prerendering
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

export const supabase = createClient(url, key);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DbGoal {
  id: string;
  user_id: string;
  title: string;
  company?: string;
  position?: string;
  language?: string;
  job_description?: string;
  result: unknown;
  completed_tasks: string[];
  saved_at: string;
}

export interface DbApplication {
  id: string;
  user_id: string;
  company: string;
  position: string;
  source: string;
  status: string;
  applied_at: string;
  interview_date?: string | null;
  notes?: string | null;
  rejection_reason?: string | null;
}

export interface DbProfile {
  id: string;
  name: string;
  cv_text?: string;
}
