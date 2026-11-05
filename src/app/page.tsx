'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  portfolio: string;
  languages: string;
  education: string;
  experience: string;
  skills: string;
}

interface AutofillData {
  name: string;
  email: string;
  phone: string;
  location: string;
  portfolio: string;
  summary: string;
  why_company: string;
}

interface AnalysisResult {
  fit_score: number;
  fit_summary: string;
  strengths: string[];
  gaps: string[];
  cv_tips: string[];
  cover_letter: string;
  autofill: AutofillData;
}

interface LearningPhase {
  name: string;
  duration: string;
  goal: string;
  actions: string[];
}

interface LearningResource {
  name: string;
  platform: string;
  priority: 'alta' | 'media' | 'baja';
}

interface LearningPlan {
  timeline: string;
  objective: string;
  phases: LearningPhase[];
  resources: LearningResource[];
  quick_wins: string[];
}

interface SavedGoal {
  id: string;
  savedAt: string;
  profileId: string;
  company: string;
  position: string;
  language: string;
  analysis: AnalysisResult;
  learningPlan?: LearningPlan;
  completedTasks?: string[]; // "p{i}_a{j}"
}

type AppStatus = 'applied' | 'screening' | 'interview' | 'offer' | 'rejected' | 'withdrawn';

interface JobApplication {
  id: string;
  createdAt: string;
  company: string;
  position: string;
  source: string;
  status: AppStatus;
  interviewDate?: string; // ISO date string
  rejectionReason?: string;
  notes?: string;
  interviewQuestions?: string[];
}

type AppView = 'landing' | 'login' | 'analyze' | 'profile' | 'goals' | 'applications';
type ResultTab = 'fit' | 'tips' | 'letter' | 'autofill' | 'plan';

// ── Supabase row → app type mappers ──────────────────────────────────────────

function rowToGoal(row: Record<string, unknown>, userId: string): SavedGoal {
  return {
    id: row.id as string,
    savedAt: row.saved_at as string,
    profileId: userId,
    company: (row.company as string) ?? '',
    position: row.position as string,
    language: (row.language as string) ?? 'es',
    analysis: row.analysis as AnalysisResult,
    learningPlan: row.learning_plan as LearningPlan | undefined,
    completedTasks: (row.completed_tasks as string[]) ?? [],
  };
}

function rowToApp(row: Record<string, unknown>): JobApplication {
  return {
    id: row.id as string,
    createdAt: row.applied_at as string,
    company: row.company as string,
    position: row.position as string,
    source: row.source as string,
    status: row.status as AppStatus,
    interviewDate: (row.interview_date as string | null) ?? undefined,
    rejectionReason: (row.rejection_reason as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    interviewQuestions: (row.interview_questions as string[] | null) ?? undefined,
  };
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AppStatus, { label: string; color: string; bg: string; border: string }> = {
  applied:   { label: 'Postulada',    color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  screening: { label: 'En revisión',  color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
  interview: { label: 'Entrevista',   color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd' },
  offer:     { label: 'Oferta',       color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  rejected:  { label: 'Rechazada',    color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  withdrawn: { label: 'Retirada',     color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0' },
};

const SOURCES = ['LinkedIn', 'Indeed', 'Computrabajo', 'OCC', 'Referido/a', 'Sitio de la empresa', 'Otro'];

// ── Build CV text from profile ────────────────────────────────────────────────

function buildCVText(p: UserProfile): string {
  return [
    `Nombre: ${p.name}`,
    p.email && `Email: ${p.email}`,
    p.phone && `Teléfono: ${p.phone}`,
    p.location && `Ubicación: ${p.location}`,
    p.portfolio && `Portfolio: ${p.portfolio}`,
    p.languages && `Idiomas: ${p.languages}`,
    p.education && `\nEDUCACIÓN:\n${p.education}`,
    p.experience && `\nEXPERIENCIA:\n${p.experience}`,
    p.skills && `\nHABILIDADES:\n${p.skills}`,
  ].filter(Boolean).join('\n');
}

// ── Small UI components ───────────────────────────────────────────────────────

function CircularScore({ score }: { score: number }) {
  const [displayed, setDisplayed] = useState(0);
  const r = 68, circ = 2 * Math.PI * r;
  const offset = circ - (displayed / 100) * circ;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 75 ? 'Excelente ajuste' : score >= 50 ? 'Buen ajuste' : 'Ajuste parcial';

  useEffect(() => {
    const t = setTimeout(() => setDisplayed(score), 80);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="168" height="168" viewBox="0 0 168 168">
        <circle cx="84" cy="84" r={r} fill="none" stroke="#e2e8f0" strokeWidth="14" />
        <circle cx="84" cy="84" r={r} fill="none" stroke={color} strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${circ}`} strokeDashoffset={`${offset}`}
          transform="rotate(-90 84 84)"
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <text x="84" y="78" textAnchor="middle" fontSize="36" fontWeight="800" fill="#0f172a">{displayed}</text>
        <text x="84" y="98" textAnchor="middle" fontSize="11" fill="#64748b">% de afinidad</text>
      </svg>
      <span className="text-sm font-semibold px-3 py-1 rounded-full"
        style={{ background: `${color}18`, color }}>{label}</span>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle');
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setState('ok'); }
    catch { setState('err'); }
    setTimeout(() => setState('idle'), 2000);
  };
  return (
    <button onClick={copy}
      className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-all"
      style={{
        borderColor: state === 'ok' ? '#10b981' : state === 'err' ? '#ef4444' : '#e2e8f0',
        color: state === 'ok' ? '#10b981' : state === 'err' ? '#ef4444' : '#64748b',
        background: state === 'ok' ? '#f0fdf4' : state === 'err' ? '#fef2f2' : '#fff',
      }}>
      {state === 'ok' ? '✓ Copiado' : state === 'err' ? '✗ Error' : 'Copiar'}
    </button>
  );
}

function Spinner({ label = 'Procesando…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin"
          style={{ animationDuration: '0.9s' }} />
      </div>
      <div className="text-center space-y-1">
        <p className="text-slate-700 font-medium text-sm">{label}</p>
        <p className="text-slate-400 text-xs">Esto puede tardar unos segundos</p>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-3 text-sm font-medium transition-all whitespace-nowrap ${active ? 'tab-active' : 'tab-inactive'}`}>
      {children}
    </button>
  );
}

function PriorityBadge({ p }: { p: 'alta' | 'media' | 'baja' }) {
  const styles = {
    alta: 'bg-red-50 text-red-600 border-red-100',
    media: 'bg-amber-50 text-amber-600 border-amber-100',
    baja: 'bg-slate-50 text-slate-500 border-slate-100',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${styles[p]}`}>
      {p}
    </span>
  );
}

function StatusBadge({ status }: { status: AppStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded border"
      style={{ color: c.color, background: c.bg, borderColor: c.border }}>
      {c.label}
    </span>
  );
}

// ── CSV import helpers ────────────────────────────────────────────────────────

const CSV_FIELD_MAP: Record<string, keyof Omit<UserProfile, 'id'>> = {
  nombre: 'name',       name: 'name',
  email: 'email',       correo: 'email',
  telefono: 'phone',    phone: 'phone',
  ubicacion: 'location', location: 'location',
  portfolio: 'portfolio', sitio: 'portfolio',
  idiomas: 'languages', languages: 'languages',
  educacion: 'education', education: 'education', formacion: 'education',
  experiencia: 'experience', experience: 'experience',
  habilidades: 'skills', skills: 'skills', competencias: 'skills',
};

const MULTI_FIELDS = new Set<string>(['education', 'experience', 'skills']);

function parseKeyValueCSV(text: string): Partial<Omit<UserProfile, 'id'>> {
  const lines = text.split(/\r?\n/).filter(l => {
    const t = l.trim();
    return t && !t.startsWith('campo') && !t.startsWith('field');
  });
  const multi: Record<string, string[]> = {};
  const single: Record<string, string> = {};

  for (const line of lines) {
    const commaIdx = line.indexOf(',');
    if (commaIdx === -1) continue;
    const rawKey = line.slice(0, commaIdx).trim().toLowerCase();
    let val = line.slice(commaIdx + 1).trim();
    if (val.startsWith('"')) {
      val = val.slice(1);
      if (val.endsWith('"')) val = val.slice(0, -1);
      val = val.replace(/""/g, '"');
    }
    const field = CSV_FIELD_MAP[rawKey];
    if (!field || !val) continue;
    if (MULTI_FIELDS.has(field)) {
      if (!multi[field]) multi[field] = [];
      multi[field].push(val);
    } else {
      single[field] = val;
    }
  }

  const result: Record<string, string> = { ...single };
  for (const [field, vals] of Object.entries(multi)) {
    result[field] = vals.join('\n');
  }
  return result as Partial<Omit<UserProfile, 'id'>>;
}

const CSV_TEMPLATE = `campo,valor
nombre,Tu Nombre Completo
email,tu@email.com
telefono,+52 1 55 1234 5678
ubicacion,"Ciudad, Estado, País"
portfolio,tudominio.com
idiomas,"Español nativo, Inglés B2"
educacion,"Nombre de carrera — Universidad (año)"
educacion,"Otra carrera — Otra universidad (año)"
experiencia,"Puesto — Empresa: descripción breve de lo que hiciste"
experiencia,"Otro puesto — Otra empresa: descripción breve"
habilidades,"Skill 1, Skill 2, Skill 3"
habilidades,"Otra categoría de habilidades"
`;

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'plantilla_cv.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Profile Form ──────────────────────────────────────────────────────────────

function ProfileForm({ initial, onSave, onCancel }: {
  initial?: Partial<UserProfile>;
  onSave: (p: UserProfile) => void;
  onCancel?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [form, setForm] = useState<Omit<UserProfile, 'id'>>({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    location: initial?.location ?? '',
    portfolio: initial?.portfolio ?? '',
    languages: initial?.languages ?? '',
    education: initial?.education ?? '',
    experience: initial?.experience ?? '',
    skills: initial?.skills ?? '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseKeyValueCSV(text);
        const filled = Object.keys(parsed).length;
        if (filled === 0) throw new Error('No se encontraron campos reconocidos');
        setForm(f => ({ ...f, ...parsed }));
        setImportMsg({ type: 'ok', text: `✓ ${filled} campo${filled > 1 ? 's' : ''} importado${filled > 1 ? 's' : ''} desde el CSV` });
      } catch (err) {
        setImportMsg({ type: 'err', text: err instanceof Error ? err.message : 'Error al leer el CSV' });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, id: initial?.id ?? crypto.randomUUID() });
  };

  const inputClass = "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition placeholder:text-slate-400";
  const textareaClass = `${inputClass} resize-none font-mono leading-relaxed`;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-indigo-700">Importar desde CSV</p>
            <p className="text-xs text-indigo-500">Llena la plantilla y súbela — se autocompleta el formulario</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={downloadTemplate}
              className="text-xs font-medium text-indigo-600 border border-indigo-200 bg-white hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition">
              ⬇ Plantilla
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition">
              📎 Importar CSV
            </button>
          </div>
        </div>
        {importMsg && (
          <p className={`text-xs font-medium ${importMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
            {importMsg.text}
          </p>
        )}
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleCSVImport} className="hidden" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Nombre completo *</label>
          <input required value={form.name} onChange={set('name')} placeholder="Tu nombre" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Email *</label>
          <input required type="email" value={form.email} onChange={set('email')} placeholder="tu@email.com" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Teléfono</label>
          <input value={form.phone} onChange={set('phone')} placeholder="+52 1 55 1234 5678" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Ubicación</label>
          <input value={form.location} onChange={set('location')} placeholder="Ciudad, Estado, País" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Portfolio / Sitio web</label>
          <input value={form.portfolio} onChange={set('portfolio')} placeholder="tudominio.com" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Idiomas</label>
          <input value={form.languages} onChange={set('languages')} placeholder="Español nativo, Inglés C1" className={inputClass} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">Educación</label>
        <p className="text-xs text-slate-400">Carrera, institución, año — una por línea</p>
        <textarea rows={3} value={form.education} onChange={set('education')}
          placeholder="Ing. en Ciencias de Datos — UVM (2026)&#10;Lic. en Ciencias de Alimentos — UANL (2020)"
          className={textareaClass} />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">Experiencia laboral</label>
        <p className="text-xs text-slate-400">Puesto, empresa, descripción breve — un bloque por trabajo</p>
        <textarea rows={5} value={form.experience} onChange={set('experience')}
          placeholder="QA &amp; Compliance Lead — QBridge AI&#10;Liderazgo de procesos de QA para plataformas de IA en entornos regulados.&#10;&#10;PM SAP — Avant Santé Research Center&#10;Gestión de proyectos con ERP SAP en contexto de investigación clínica."
          className={textareaClass} />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">Habilidades técnicas</label>
        <textarea rows={3} value={form.skills} onChange={set('skills')}
          placeholder="React, Next.js, TypeScript, PostgreSQL, Supabase, Python, QA, compliance (COFEPRIS, FDA)"
          className={textareaClass} />
      </div>

      <div className="flex gap-3">
        <button type="submit"
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-sm">
          Guardar perfil
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-3 rounded-xl text-sm transition-all">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

// ── Learning Plan display (interactive checkboxes) ────────────────────────────

function LearningPlanView({
  plan,
  completedTasks,
  onToggleTask,
}: {
  plan: LearningPlan;
  completedTasks?: string[];
  onToggleTask?: (key: string) => void;
}) {
  const done = new Set(completedTasks ?? []);
  const totalActions = plan.phases.reduce((s, p) => s + p.actions.length, 0);
  const doneActions = plan.phases.reduce((s, p, i) =>
    s + p.actions.filter((_, j) => done.has(`p${i}_a${j}`)).length, 0);
  const pct = totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 0;
  const interactive = !!onToggleTask;

  return (
    <div className="space-y-6">
      {/* Objective */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
        <span className="text-2xl">🎯</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Duración estimada</span>
            <span className="text-sm font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">{plan.timeline}</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{plan.objective}</p>
        </div>
      </div>

      {/* Overall progress (only in interactive/goals mode) */}
      {interactive && totalActions > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Progreso general</span>
            <span className="font-semibold text-slate-700">{doneActions} / {totalActions} tareas</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? '#10b981' : pct > 50 ? '#6366f1' : '#a5b4fc',
              }}
            />
          </div>
          <p className="text-xs text-right font-medium" style={{ color: pct === 100 ? '#10b981' : '#6366f1' }}>
            {pct}% completado
          </p>
        </div>
      )}

      {/* Phases */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Fases del plan</h3>
        {plan.phases.map((phase, i) => {
          const phaseTotal = phase.actions.length;
          const phaseDone = phase.actions.filter((_, j) => done.has(`p${i}_a${j}`)).length;
          const phasePct = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;

          return (
            <div key={i} className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-slate-800">{phase.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{phase.duration}</span>
                </div>
                {interactive && (
                  <span className="text-xs font-medium text-slate-500 shrink-0">
                    {phaseDone}/{phaseTotal}
                    {phasePct === 100 && <span className="ml-1 text-emerald-500">✓</span>}
                  </span>
                )}
              </div>
              {/* Phase progress bar */}
              {interactive && (
                <div className="h-1 bg-slate-100">
                  <div className="h-full bg-indigo-400 transition-all duration-300" style={{ width: `${phasePct}%` }} />
                </div>
              )}
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs text-slate-500 italic">{phase.goal}</p>
                <ul className="space-y-2">
                  {phase.actions.map((a, j) => {
                    const key = `p${i}_a${j}`;
                    const checked = done.has(key);
                    return (
                      <li key={j} className="flex items-start gap-2 text-sm text-slate-700">
                        {interactive ? (
                          <button
                            onClick={() => onToggleTask!(key)}
                            className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                              checked
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 hover:border-indigo-400'
                            }`}
                          >
                            {checked && <span className="text-[9px] font-bold">✓</span>}
                          </button>
                        ) : (
                          <span className="text-indigo-400 mt-0.5 shrink-0">→</span>
                        )}
                        <span className={checked ? 'line-through text-slate-400' : ''}>{a}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resources */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Recursos recomendados</h3>
        <div className="space-y-2">
          {plan.resources.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
                <p className="text-xs text-slate-400">{r.platform}</p>
              </div>
              <PriorityBadge p={r.priority} />
            </div>
          ))}
        </div>
      </div>

      {/* Quick wins */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">⚡ Quick wins — empieza esta semana</h3>
        <ul className="space-y-2">
          {plan.quick_wins.map((w, i) => (
            <li key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-slate-700">
              <span className="text-emerald-500 font-bold shrink-0">{i + 1}.</span>{w}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Goals View ────────────────────────────────────────────────────────────────

function GoalsView({ userId, profile, onBack }: { userId: string; profile: UserProfile | null; onBack: () => void }) {
  const [goals, setGoals] = useState<SavedGoal[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState<string | null>(null);
  const [planError, setPlanError] = useState('');

  useEffect(() => {
    supabase.from('goals').select('*').eq('user_id', userId).order('saved_at', { ascending: false })
      .then(({ data }) => { if (data) setGoals(data.map(r => rowToGoal(r as Record<string, unknown>, userId))); });
  }, [userId]);

  const deleteGoal = async (id: string) => {
    await supabase.from('goals').delete().eq('id', id);
    setGoals(g => g.filter(x => x.id !== id));
    if (expanded === id) setExpanded(null);
  };

  const toggleTask = async (goalId: string, key: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const done = new Set(goal.completedTasks ?? []);
    if (done.has(key)) done.delete(key); else done.add(key);
    const newTasks = Array.from(done);
    await supabase.from('goals').update({ completed_tasks: newTasks }).eq('id', goalId);
    setGoals(gs => gs.map(g => g.id === goalId ? { ...g, completedTasks: newTasks } : g));
  };

  const generatePlan = async (goal: SavedGoal) => {
    setGeneratingPlan(goal.id);
    setPlanError('');
    try {
      const user_cv = profile ? buildCVText(profile) : '';

      const res = await fetch('/api/learning-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: goal.position,
          company: goal.company,
          gaps: goal.analysis.gaps,
          strengths: goal.analysis.strengths,
          user_cv,
          language: goal.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await supabase.from('goals').update({ learning_plan: data }).eq('id', goal.id);
      setGoals(gs => gs.map(g => g.id === goal.id ? { ...g, learningPlan: data } : g));
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Error al generar el plan');
    } finally {
      setGeneratingPlan(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition text-sm">← Volver</button>
        <h2 className="text-lg font-bold text-slate-900">Mis metas</h2>
      </div>

      {goals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
          <p className="text-3xl">🎯</p>
          <p className="font-medium text-slate-700">No tienes metas guardadas aún</p>
          <p className="text-sm text-slate-400">
            Analiza una vacante y guárdala como meta para recibir un plan de desarrollo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {planError && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
              {planError}
            </div>
          )}
          {goals.map(goal => {
            const totalTasks = goal.learningPlan
              ? goal.learningPlan.phases.reduce((s, p) => s + p.actions.length, 0)
              : 0;
            const doneTasks = totalTasks > 0
              ? (goal.completedTasks?.length ?? 0)
              : 0;
            const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

            return (
              <div key={goal.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition"
                  onClick={() => setExpanded(e => e === goal.id ? null : goal.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{goal.position}</span>
                      {goal.company && (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{goal.company}</span>
                      )}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={{
                          background: goal.analysis.fit_score >= 75 ? '#d1fae5' : goal.analysis.fit_score >= 50 ? '#fef3c7' : '#fee2e2',
                          color: goal.analysis.fit_score >= 75 ? '#059669' : goal.analysis.fit_score >= 50 ? '#d97706' : '#dc2626',
                        }}>
                        {goal.analysis.fit_score}% fit
                      </span>
                      {goal.learningPlan && (
                        <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">📋 Plan listo</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(goal.savedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {/* Progress bar in card header */}
                    {totalTasks > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: pct === 100 ? '#10b981' : '#6366f1',
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-500 shrink-0">{pct}%</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteGoal(goal.id); }}
                    className="text-slate-300 hover:text-red-400 transition shrink-0"
                  >✕</button>
                  <span className="text-slate-400 text-sm">{expanded === goal.id ? '▲' : '▼'}</span>
                </div>

                {expanded === goal.id && (
                  <div className="border-t border-slate-100 p-5 space-y-5">
                    {!goal.learningPlan ? (
                      <div className="text-center py-4 space-y-3">
                        <p className="text-sm text-slate-500">
                          Genera un plan de desarrollo personalizado para alcanzar esta meta.
                        </p>
                        <button
                          onClick={() => generatePlan(goal)}
                          disabled={generatingPlan === goal.id}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
                        >
                          {generatingPlan === goal.id ? '⏳ Generando plan…' : '✦ Generar plan de desarrollo'}
                        </button>
                        {generatingPlan === goal.id && <Spinner label="Creando tu plan personalizado…" />}
                      </div>
                    ) : (
                      <LearningPlanView
                        plan={goal.learningPlan}
                        completedTasks={goal.completedTasks}
                        onToggleTask={(key) => toggleTask(goal.id, key)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Application Tracker View ──────────────────────────────────────────────────

type TrainingPrompt = { position: string; reason: string } | null;

function ApplicationTrackerView({
  userId,
  profileName,
  onBack,
  onAnalyze,
}: {
  userId: string;
  profileName: string;
  onBack: () => void;
  onAnalyze: (position?: string) => void;
}) {
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trainingPrompt, setTrainingPrompt] = useState<TrainingPrompt>(null);
  const [generatingQs, setGeneratingQs] = useState<string | null>(null);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'calendar'>('dashboard');

  const emptyForm = {
    company: '', position: '', source: 'LinkedIn',
    status: 'applied' as AppStatus, interviewDate: '', rejectionReason: '', notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    supabase.from('applications').select('*').eq('user_id', userId).order('applied_at', { ascending: false })
      .then(({ data }) => { if (data) setApps(data.map(r => rowToApp(r as Record<string, unknown>))); });
  }, [userId]);

  const handleSave = async () => {
    if (!form.position.trim()) return;
    if (editingId) {
      await supabase.from('applications').update({
        company: form.company, position: form.position, source: form.source, status: form.status,
        interview_date: form.interviewDate || null, rejection_reason: form.rejectionReason || null, notes: form.notes || null,
      }).eq('id', editingId);
      setApps(apps => apps.map(a => a.id === editingId
        ? { ...a, ...form, interviewDate: form.interviewDate || undefined, rejectionReason: form.rejectionReason || undefined, notes: form.notes || undefined }
        : a
      ));
    } else {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await supabase.from('applications').insert({
        id, user_id: userId, company: form.company, position: form.position,
        source: form.source, status: form.status, applied_at: now,
        interview_date: form.interviewDate || null, rejection_reason: form.rejectionReason || null, notes: form.notes || null,
      });
      setApps(apps => [{
        id, createdAt: now, company: form.company, position: form.position,
        source: form.source, status: form.status,
        interviewDate: form.interviewDate || undefined, rejectionReason: form.rejectionReason || undefined, notes: form.notes || undefined,
      }, ...apps]);
    }
    if (form.status === 'rejected' && form.rejectionReason.trim()) {
      setTrainingPrompt({ position: form.position, reason: form.rejectionReason });
    }
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (app: JobApplication) => {
    setForm({
      company: app.company,
      position: app.position,
      source: app.source,
      status: app.status,
      interviewDate: app.interviewDate ?? '',
      rejectionReason: app.rejectionReason ?? '',
      notes: app.notes ?? '',
    });
    setEditingId(app.id);
    setShowForm(true);
  };

  const deleteApp = async (id: string) => {
    await supabase.from('applications').delete().eq('id', id);
    setApps(apps => apps.filter(a => a.id !== id));
    if (expandedApp === id) setExpandedApp(null);
  };

  const generateInterviewQs = async (app: JobApplication) => {
    setGeneratingQs(app.id);
    try {
      const res = await fetch('/api/interview-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: app.position, company: app.company, language: 'es' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await supabase.from('applications').update({ interview_questions: data.questions }).eq('id', app.id);
      setApps(apps => apps.map(a => a.id === app.id ? { ...a, interviewQuestions: data.questions } : a));
    } catch {
      // silently fail — user can retry
    } finally {
      setGeneratingQs(null);
    }
  };

  // ── Dashboard stats ──
  const total = apps.length;
  const responded = apps.filter(a => ['screening', 'interview', 'offer', 'rejected'].includes(a.status)).length;
  const interviews = apps.filter(a => ['interview', 'offer'].includes(a.status)).length;
  const offers = apps.filter(a => a.status === 'offer').length;
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const a of apps) {
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    bySource[a.source] = (bySource[a.source] ?? 0) + 1;
  }

  // Calendar: apps with interview date
  const upcoming = apps
    .filter(a => a.interviewDate)
    .sort((a, b) => new Date(a.interviewDate!).getTime() - new Date(b.interviewDate!).getTime());

  const inputClass = "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition placeholder:text-slate-400";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition text-sm">← Volver</button>
          <h2 className="text-lg font-bold text-slate-900">Mis postulaciones</h2>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(s => !s); }}
          className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg transition"
        >
          + Registrar
        </button>
      </div>

      {/* Training prompt banner */}
      {trainingPrompt && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-800">¿Quieres prepararte para esta área?</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Motivo de rechazo: <em>{trainingPrompt.reason}</em>
              </p>
            </div>
            <button onClick={() => setTrainingPrompt(null)} className="text-amber-400 hover:text-amber-600 text-xs shrink-0">✕</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setTrainingPrompt(null); onAnalyze(trainingPrompt.position); }}
              className="text-xs font-semibold text-amber-700 border border-amber-300 bg-white hover:bg-amber-50 px-3 py-1.5 rounded-lg transition"
            >
              Analizar vacante similar →
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">{editingId ? 'Editar postulación' : 'Nueva postulación'}</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Puesto *</label>
              <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                placeholder="Data Analyst, QA Tester…" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Empresa</label>
              <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                placeholder="Nombre de la empresa" className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">¿Dónde la encontraste?</label>
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className={inputClass}>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Estado</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as AppStatus }))}
                className={inputClass}>
                {(Object.entries(STATUS_CONFIG) as [AppStatus, typeof STATUS_CONFIG[AppStatus]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Interview date — only when status = interview */}
          {form.status === 'interview' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Fecha de entrevista</label>
              <input type="datetime-local" value={form.interviewDate}
                onChange={e => setForm(f => ({ ...f, interviewDate: e.target.value }))}
                className={inputClass} />
            </div>
          )}

          {/* Rejection reason — only when status = rejected */}
          {form.status === 'rejected' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">¿Por qué te rechazaron? <span className="text-slate-400">(opcional)</span></label>
              <input value={form.rejectionReason}
                onChange={e => setForm(f => ({ ...f, rejectionReason: e.target.value }))}
                placeholder="Ej: faltaba experiencia en Python, buscaban perfil senior…"
                className={inputClass} />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Notas <span className="text-slate-400">(opcional)</span></label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Cualquier detalle adicional" className={inputClass} />
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!form.position.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-all">
              {editingId ? 'Guardar cambios' : 'Registrar postulación'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
              className="px-4 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-sm transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabs: Dashboard / Lista / Calendario */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 flex">
          {(['dashboard', 'list', 'calendar'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-3 text-sm font-medium transition-all ${activeTab === t ? 'tab-active' : 'tab-inactive'}`}>
              {t === 'dashboard' ? '📊 Dashboard' : t === 'list' ? '📋 Lista' : '📅 Calendario'}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ── Dashboard ── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {total === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-3xl">📋</p>
                  <p className="text-sm text-slate-500">Registra tu primera postulación para ver el dashboard</p>
                </div>
              ) : (
                <>
                  {/* Stat cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total', value: total, color: '#6366f1', bg: '#eef2ff' },
                      { label: 'Tasa de respuesta', value: `${responseRate}%`, color: '#8b5cf6', bg: '#f5f3ff' },
                      { label: 'Entrevistas', value: interviews, color: '#0ea5e9', bg: '#f0f9ff' },
                      { label: 'Ofertas', value: offers, color: '#10b981', bg: '#ecfdf5' },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl p-4 text-center border"
                        style={{ background: s.bg, borderColor: `${s.color}30` }}>
                        <p className="text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* By status */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Por estado</h3>
                    <div className="space-y-2">
                      {(Object.entries(byStatus) as [AppStatus, number][])
                        .sort((a, b) => b[1] - a[1])
                        .map(([s, count]) => {
                          const c = STATUS_CONFIG[s];
                          const pct = total > 0 ? (count / total) * 100 : 0;
                          return (
                            <div key={s} className="flex items-center gap-3">
                              <StatusBadge status={s} />
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%`, background: c.color }} />
                              </div>
                              <span className="text-xs font-semibold text-slate-600 w-4 text-right">{count}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* By source */}
                  {Object.keys(bySource).length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">¿Dónde las encontré?</h3>
                      <div className="space-y-2">
                        {Object.entries(bySource)
                          .sort((a, b) => b[1] - a[1])
                          .map(([src, count]) => {
                            const pct = total > 0 ? (count / total) * 100 : 0;
                            return (
                              <div key={src} className="flex items-center gap-3">
                                <span className="text-xs text-slate-600 w-24 truncate shrink-0">{src}</span>
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-indigo-400 transition-all duration-500"
                                    style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-slate-600 w-4 text-right">{count}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Lista ── */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {apps.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-3xl">📋</p>
                  <p className="text-sm text-slate-500">Aún no tienes postulaciones registradas</p>
                </div>
              ) : (
                apps.map(app => (
                  <div key={app.id} className="rounded-xl border border-slate-100 overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 transition"
                      onClick={() => setExpandedApp(e => e === app.id ? null : app.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{app.position}</span>
                          {app.company && <span className="text-xs text-slate-400">{app.company}</span>}
                          <select
                            value={app.status}
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              e.stopPropagation();
                              const newStatus = e.target.value as AppStatus;
                              supabase.from('applications').update({ status: newStatus }).eq('id', app.id).then(() => {});
                              setApps(apps => apps.map(a => a.id === app.id ? { ...a, status: newStatus } : a));
                              if (newStatus === 'interview') {
                                setExpandedApp(app.id);
                                startEdit({ ...app, status: newStatus });
                                setShowForm(true);
                              }
                            }}
                            className="text-xs font-semibold px-2 py-0.5 rounded border cursor-pointer focus:outline-none"
                            style={{
                              color: STATUS_CONFIG[app.status].color,
                              background: STATUS_CONFIG[app.status].bg,
                              borderColor: STATUS_CONFIG[app.status].border,
                            }}
                          >
                            {(Object.entries(STATUS_CONFIG) as [AppStatus, typeof STATUS_CONFIG[AppStatus]][]).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                          {app.interviewDate && (
                            <span className="text-xs text-sky-600 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded">
                              📅 {new Date(app.interviewDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {app.source} · {new Date(app.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); startEdit(app); }}
                        className="text-slate-300 hover:text-indigo-400 transition text-xs shrink-0">✏️</button>
                      <button onClick={e => { e.stopPropagation(); deleteApp(app.id); }}
                        className="text-slate-300 hover:text-red-400 transition shrink-0">✕</button>
                      <span className="text-slate-400 text-sm">{expandedApp === app.id ? '▲' : '▼'}</span>
                    </div>

                    {expandedApp === app.id && (
                      <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50">
                        {app.rejectionReason && (
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                            <span className="text-red-400 text-xs mt-0.5 shrink-0">⚠</span>
                            <div>
                              <p className="text-xs font-semibold text-red-700">Motivo de rechazo</p>
                              <p className="text-xs text-red-600 mt-0.5">{app.rejectionReason}</p>
                            </div>
                            <button
                              onClick={() => { setTrainingPrompt({ position: app.position, reason: app.rejectionReason! }); setExpandedApp(null); }}
                              className="ml-auto text-xs font-semibold text-amber-600 border border-amber-200 bg-white hover:bg-amber-50 px-2 py-1 rounded-lg transition shrink-0"
                            >
                              Capacitarme →
                            </button>
                          </div>
                        )}
                        {app.notes && <p className="text-xs text-slate-500 italic">{app.notes}</p>}

                        {/* Interview questions */}
                        {app.status === 'interview' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-slate-600">Posibles preguntas de entrevista</p>
                              {!app.interviewQuestions && (
                                <button
                                  onClick={() => generateInterviewQs(app)}
                                  disabled={generatingQs === app.id}
                                  className="text-xs font-semibold text-sky-600 border border-sky-200 bg-white hover:bg-sky-50 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
                                >
                                  {generatingQs === app.id ? '⏳ Generando…' : '✦ Generar preguntas'}
                                </button>
                              )}
                            </div>
                            {generatingQs === app.id && <Spinner label="Generando preguntas…" />}
                            {app.interviewQuestions && (
                              <ul className="space-y-1.5">
                                {app.interviewQuestions.map((q, i) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700 p-2.5 rounded-lg bg-white border border-slate-100">
                                    <span className="text-sky-400 font-bold shrink-0">{i + 1}.</span>{q}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Calendario ── */}
          {activeTab === 'calendar' && (
            <div className="space-y-4">
              {upcoming.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-3xl">📅</p>
                  <p className="text-sm text-slate-500">No tienes entrevistas programadas</p>
                  <p className="text-xs text-slate-400">Registra una postulación con estado "Entrevista" y agrega la fecha.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500">Entrevistas próximas ordenadas por fecha</p>
                  {upcoming.map(app => {
                    const d = new Date(app.interviewDate!);
                    const now = new Date();
                    const diffMs = d.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    const isPast = diffMs < 0;

                    return (
                      <div key={app.id} className={`rounded-xl border p-4 space-y-3 ${isPast ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-sky-50 border-sky-100'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{app.position}</p>
                            {app.company && <p className="text-xs text-slate-500">{app.company}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-sky-700">
                              {d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                            <p className="text-xs text-sky-500">
                              {d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {!isPast && (
                              <span className={`text-xs font-semibold mt-0.5 block ${diffDays <= 2 ? 'text-orange-500' : 'text-sky-500'}`}>
                                {diffDays === 0 ? '¡Hoy!' : diffDays === 1 ? 'Mañana' : `En ${diffDays} días`}
                              </span>
                            )}
                            {isPast && <span className="text-xs text-slate-400">Pasada</span>}
                          </div>
                        </div>

                        {/* Interview questions section */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-600">Preguntas de preparación</p>
                            {!app.interviewQuestions && (
                              <button
                                onClick={() => generateInterviewQs(app)}
                                disabled={generatingQs === app.id}
                                className="text-xs font-semibold text-sky-600 border border-sky-200 bg-white hover:bg-sky-50 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
                              >
                                {generatingQs === app.id ? '⏳ Generando…' : '✦ Preparar entrevista'}
                              </button>
                            )}
                          </div>
                          {generatingQs === app.id && <Spinner label="Generando preguntas de entrevista…" />}
                          {app.interviewQuestions && (
                            <ul className="space-y-1.5">
                              {app.interviewQuestions.map((q, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-slate-700 p-2.5 rounded-lg bg-white border border-sky-100">
                                  <span className="text-sky-400 font-bold shrink-0">{i + 1}.</span>{q}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Auth view (email + password) ─────────────────────────────────────────────

function AuthView({ onBack, initialMode = 'login' }: { onBack: () => void; initialMode?: 'login' | 'signup' }) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSuccess('Iniciando sesión…');
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          setSuccess('¡Cuenta creada! Iniciando sesión…');
        } else {
          setSuccess('¡Cuenta creada! Revisa tu email para confirmar.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-white/20 bg-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-300 transition mb-2 block mx-auto">
            ← Volver
          </button>
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-indigo-400 text-xl">✦</span>
            <span className="font-bold text-lg tracking-tight text-white">Job Apply</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white">
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h2>
          <p className="text-slate-400 text-sm">
            {mode === 'login' ? 'Accede a tus postulaciones y metas' : 'Empieza a optimizar tus aplicaciones'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" required placeholder="tu@email.com" value={email}
            onChange={e => setEmail(e.target.value)} className={inputClass} />
          <input type="password" required placeholder="Contraseña (mín. 6 caracteres)" value={password}
            onChange={e => setPassword(e.target.value)} className={inputClass} />

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          {success && <p className="text-green-400 text-xs text-center">{success}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-lg">
            {loading ? '…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400">
          {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); }}
            className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 transition">
            {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Landing page ─────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: '📊', title: 'Análisis de afinidad', desc: 'Porcentaje de match con tu perfil, fortalezas y brechas en segundos.' },
  { icon: '📝', title: 'Tips de CV', desc: 'Qué experiencias y proyectos resaltar para cada vacante específica.' },
  { icon: '✉️', title: 'Carta de presentación', desc: 'Lista para enviar, en español o inglés, sin plantillas genéricas.' },
  { icon: '🎯', title: 'Plan de desarrollo', desc: 'Ruta de capacitación personalizada para las vacantes que aspiras.' },
];

function LandingView({ onLogin, onRegister }: {
  onLogin: () => void;
  onRegister: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 text-xl">✦</span>
          <span className="font-bold text-lg tracking-tight">Job Apply</span>
        </div>
        <button onClick={onLogin} className="text-sm font-medium text-slate-300 hover:text-white transition">
          Iniciar sesión →
        </button>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 space-y-8 max-w-3xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          IA gratuita · Sin costos · Datos en la nube
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Tu aplicación de empleo,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              personalizada con IA
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Pega la descripción de cualquier vacante y obtén análisis de afinidad, carta de presentación y tu plan de desarrollo — en segundos.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button onClick={onRegister}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-900/40 hover:shadow-indigo-900/60 hover:-translate-y-0.5">
            Crear cuenta gratis
          </button>
          <button onClick={onLogin}
            className="text-sm text-slate-400 hover:text-slate-200 transition">
            ¿Ya tienes cuenta? <span className="underline underline-offset-2">Inicia sesión</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full pt-4">
          {FEATURES.map(f => (
            <div key={f.title}
              className="text-left p-5 rounded-2xl bg-white/5 border border-white/8 hover:bg-white/8 transition space-y-2">
              <span className="text-2xl">{f.icon}</span>
              <h3 className="font-semibold text-sm text-white">{f.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="text-center py-5 text-xs text-slate-600">
        Datos guardados en la nube · Accede desde cualquier dispositivo
      </footer>
    </div>
  );
}

// ── Login / Profile selector ───────────────────────────────────────────────────

const AVATAR_COLORS = [
  ['#6366f1', '#eef2ff'], ['#8b5cf6', '#f5f3ff'], ['#ec4899', '#fdf2f8'],
  ['#14b8a6', '#f0fdfa'], ['#f59e0b', '#fffbeb'], ['#ef4444', '#fef2f2'],
];

function LoginView({ profiles, onSelect, onNewProfile, onBack }: {
  profiles: UserProfile[];
  onSelect: (id: string) => void;
  onNewProfile: () => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center px-6 py-16 space-y-8">
      <div className="text-center space-y-2">
        <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-300 transition mb-4 block mx-auto">
          ← Volver
        </button>
        <h2 className="text-2xl font-extrabold text-white">¿Quién eres?</h2>
        <p className="text-slate-400 text-sm">Selecciona tu perfil para continuar</p>
      </div>

      <div className={`grid gap-4 w-full max-w-md ${profiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {profiles.map((p, i) => {
          const [bg] = AVATAR_COLORS[i % AVATAR_COLORS.length];
          return (
            <button key={p.id} onClick={() => onSelect(p.id)}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/8 hover:bg-white/10 hover:border-white/20 transition-all hover:-translate-y-0.5">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black transition-transform group-hover:scale-105"
                style={{ background: `${bg}22`, color: bg, border: `2px solid ${bg}44` }}>
                {p.name[0]?.toUpperCase()}
              </div>
              <div className="text-center">
                <p className="font-semibold text-white text-sm">{p.name.split(' ')[0]}</p>
                <p className="text-xs text-slate-500 truncate max-w-[120px]">{p.email}</p>
              </div>
            </button>
          );
        })}
        <button onClick={onNewProfile}
          className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-dashed border-slate-700 hover:border-indigo-500 text-slate-500 hover:text-indigo-400 transition-all hover:-translate-y-0.5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 border-dashed border-current">
            +
          </div>
          <p className="text-sm font-medium">Nuevo perfil</p>
        </button>
      </div>
    </div>
  );
}

// ── Bookmarklet helper ────────────────────────────────────────────────────────

const BOOKMARKLET_CODE = `javascript:(function(){var t=window.getSelection().toString().trim();if(t.length<200)t=document.body.innerText;window.open('https://job-apply-app-one.vercel.app/#import='+encodeURIComponent(t.substring(0,8000)),'_blank');})();`;

function BookmarkletHelper() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(BOOKMARKLET_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-xs font-semibold text-violet-600 border border-violet-200 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-lg transition"
      >
        🔖 Importar desde otra web
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-4 space-y-3 z-50">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">Configurar acceso rápido (solo 1 vez)</p>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs shrink-0">✕</button>
          </div>

          <div className="space-y-2.5 text-xs text-slate-600">
            <div className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold shrink-0 text-[10px] mt-0.5">1</span>
              <p>Haz clic en <strong>Copiar código</strong> (botón de abajo)</p>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold shrink-0 text-[10px] mt-0.5">2</span>
              <p>En Chrome, abre una pestaña nueva y presiona <strong>Ctrl+Shift+O</strong> para abrir el Administrador de marcadores</p>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold shrink-0 text-[10px] mt-0.5">3</span>
              <p>Haz clic en los <strong>⋮ tres puntos</strong> (arriba a la derecha) → <strong>Añadir nuevo marcador</strong></p>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold shrink-0 text-[10px] mt-0.5">4</span>
              <p>Nómbralo como quieras (ej: <em>"Importar vacante"</em>), <strong>borra lo que diga en el campo URL</strong> y pega el código copiado ahí. Guarda.</p>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 text-[10px] mt-0.5">✓</span>
              <p>¡Listo! Cuando estés en LinkedIn, OCC, etc., haz clic en ese marcador y se abre la app con la vacante lista ✨</p>
            </div>
          </div>

          <button
            type="button"
            onClick={copy}
            className={`w-full text-xs font-semibold py-2 rounded-lg transition ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'bg-violet-600 hover:bg-violet-700 text-white'
            }`}
          >
            {copied ? '✓ ¡Código copiado!' : '1. Copiar código primero'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [view, setView] = useState<AppView>('analyze');
  const [session, setSession] = useState<Session | null>(null);
  const [dbProfile, setDbProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);

  const [form, setForm] = useState({ company: '', position: '', language: 'es', description: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>('fit');
  const [error, setError] = useState('');
  const [savedGoalId, setSavedGoalId] = useState<string | null>(null);

  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null);

  const [prefillPosition, setPrefillPosition] = useState('');
  const [pendingImport, setPendingImport] = useState('');

  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applySource, setApplySource] = useState('LinkedIn');

  const resultsRef = useRef<HTMLDivElement>(null);

  const loadDbProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setDbProfile({ id: userId, name: data.name, ...(data.profile_data as Partial<UserProfile>) } as UserProfile);
    }
  }, []);

  useEffect(() => {
    // Check URL hash for bookmarklet import
    const hash = window.location.hash;
    if (hash.startsWith('#import=')) {
      try {
        const decoded = decodeURIComponent(hash.slice(8)).trim();
        if (decoded) setPendingImport(decoded);
      } catch {}
      window.history.replaceState(null, '', window.location.pathname);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadDbProfile(session.user.id);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) loadDbProfile(session.user.id);
      else { setDbProfile(null); setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, [loadDbProfile]);

  // Apply bookmarklet import once user is logged in and profile loaded
  useEffect(() => {
    if (pendingImport && session && dbProfile) {
      setForm(f => ({ ...f, description: pendingImport }));
      setPendingImport('');
      setView('analyze');
    }
  }, [pendingImport, session, dbProfile]);

  const currentProfile = dbProfile;

  const saveProfile = async (p: UserProfile) => {
    if (!session) return;
    const { name, id: _, ...rest } = p;
    await supabase.from('profiles').upsert({
      id: session.user.id,
      name,
      profile_data: rest,
      updated_at: new Date().toISOString(),
    });
    setDbProfile({ ...p, id: session.user.id });
    setEditingProfile(false);
    setView('analyze');
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setResult(null);
    setDbProfile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !form.description.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');
    setLearningPlan(null);
    setSavedGoalId(null);
    setAppliedId(null);
    setShowApplyForm(false);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: form.company,
          position: form.position,
          language: form.language,
          job_description: form.description,
          user_cv: buildCVText(currentProfile),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al analizar');
      setResult(data);
      setActiveTab('fit');
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const saveAsGoal = useCallback(async () => {
    if (!result || !session) return;
    const id = crypto.randomUUID();
    await supabase.from('goals').insert({
      id,
      user_id: session.user.id,
      position: form.position,
      company: form.company || null,
      language: form.language,
      analysis: result,
      learning_plan: learningPlan ?? null,
      saved_at: new Date().toISOString(),
    });
    setSavedGoalId(id);
  }, [result, session, form, learningPlan]);

  const generatePlan = async () => {
    if (!result || !currentProfile) return;
    setPlanLoading(true);
    setPlanError('');
    try {
      const res = await fetch('/api/learning-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: form.position,
          company: form.company,
          gaps: result.gaps,
          strengths: result.strengths,
          user_cv: buildCVText(currentProfile),
          language: form.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLearningPlan(data);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Error al generar el plan');
    } finally {
      setPlanLoading(false);
    }
  };

  if (authLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  );

  // ── Not logged in ──
  if (!session) {
    if ((view as string) === 'login') {
      return <AuthView onBack={() => setView('landing' as AppView)} initialMode="login" />;
    }
    if ((view as string) === 'register') {
      return <AuthView onBack={() => setView('landing' as AppView)} initialMode="signup" />;
    }
    return (
      <LandingView
        onLogin={() => setView('login' as AppView)}
        onRegister={() => setView('register' as AppView)}
      />
    );
  }

  // ── Profile setup ──
  if (!dbProfile || editingProfile || view === 'profile') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <header className="text-center space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-900">
              {!dbProfile ? 'Crea tu perfil' : 'Editar perfil'}
            </h1>
            <p className="text-slate-500 text-sm">
              Esta info se usa como contexto para generar tu aplicación — sin tokens extra por re-enviarlo
            </p>
          </header>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <ProfileForm
              initial={editingProfile && currentProfile ? currentProfile : undefined}
              onSave={(p) => saveProfile(p)}
              onCancel={editingProfile && dbProfile ? () => { setEditingProfile(false); setView('analyze'); } : undefined}
            />
          </div>
        </div>
      </main>
    );
  }

  // ── Goals view ──
  if (view === 'goals' && session) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <GoalsView userId={session.user.id} profile={dbProfile} onBack={() => setView('analyze')} />
        </div>
      </main>
    );
  }

  // ── Applications view ──
  if (view === 'applications' && session) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <ApplicationTrackerView
            userId={session.user.id}
            profileName={dbProfile?.name ?? ''}
            onBack={() => setView('analyze')}
            onAnalyze={(position) => {
              if (position) setPrefillPosition(position);
              setView('analyze');
            }}
          />
        </div>
      </main>
    );
  }

  // ── Analyze view ──
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              IA gratuita · Sin costos
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Job Apply Assistant</h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setView('applications')}
              className="text-xs font-medium text-slate-500 hover:text-sky-600 px-3 py-2 rounded-lg hover:bg-sky-50 transition">
              📋 Postulaciones
            </button>
            <button onClick={() => setView('goals')}
              className="text-xs font-medium text-slate-500 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-50 transition">
              🎯 Mis metas
            </button>
            <button onClick={logout}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100 transition">
              Salir
            </button>
            <div className="relative group">
              <button className="flex items-center gap-2 text-xs font-semibold text-slate-700 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                  {currentProfile?.name[0]?.toUpperCase() ?? '?'}
                </span>
                <span className="max-w-[80px] truncate">{currentProfile?.name ?? session?.user.email}</span>
                <span className="text-slate-400">▾</span>
              </button>
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-50">
                <div className="px-4 py-2.5 text-xs text-slate-400 border-b border-slate-100 truncate">{session?.user.email}</div>
                <button onClick={() => setEditingProfile(true)}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 transition">
                  ✏️ Editar perfil
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Empresa <span className="text-slate-400 font-normal text-xs">(opcional)</span></label>
                <input type="text" placeholder="Google, Rappi, MercadoLibre…"
                  value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition placeholder:text-slate-400" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Puesto *</label>
                <input type="text" required placeholder="Frontend Dev, PM, Data Analyst…"
                  value={prefillPosition || form.position}
                  onChange={e => { setPrefillPosition(''); setForm(f => ({ ...f, position: e.target.value })); }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition placeholder:text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Idioma de la carta</label>
              <div className="flex gap-3">
                {(['es', 'en'] as const).map(lang => (
                  <label key={lang}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-all ${form.language === lang ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'}`}>
                    <input type="radio" value={lang} checked={form.language === lang}
                      onChange={e => setForm(f => ({ ...f, language: e.target.value }))} className="hidden" />
                    <span>{lang === 'es' ? '🇲🇽 Español' : '🇺🇸 English'}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">Descripción de la vacante *</label>
                <BookmarkletHelper />
              </div>
              <textarea rows={8} required
                placeholder="Pega aquí el texto completo de la oferta — o usa el bookmarklet de favoritos estando en la página de la vacante"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition resize-none placeholder:text-slate-400 font-mono leading-relaxed" />
              {form.description && (
                <p className="text-xs text-slate-400 text-right">{form.description.length.toLocaleString()} caracteres</p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 rounded-lg px-4 py-3 text-sm">
                <span className="text-red-500 mt-0.5 shrink-0">⚠</span><span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading || !form.description.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-sm hover:shadow-md active:scale-[0.99]">
              {loading ? 'Analizando…' : '✦ Analizar vacante'}
            </button>
          </form>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <Spinner label="Analizando vacante con IA…" />
          </div>
        )}

        {result && !loading && (
          <div ref={resultsRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Action banner */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-slate-500">
                  {savedGoalId ? '✓ Guardado en Mis metas' : '¿Te gustaría desarrollarte para tener un trabajo así?'}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Me postulé */}
                  {appliedId ? (
                    <button onClick={() => setView('applications')}
                      className="text-xs font-semibold text-sky-600 hover:underline">
                      Ver postulaciones →
                    </button>
                  ) : (
                    <button onClick={() => setShowApplyForm(s => !s)}
                      className="text-xs font-semibold text-sky-600 border border-sky-200 bg-white hover:bg-sky-50 px-3 py-1.5 rounded-lg transition">
                      📋 Me postulé
                    </button>
                  )}
                  {/* Guardar como meta */}
                  {savedGoalId ? (
                    <button onClick={() => setView('goals')}
                      className="text-xs font-semibold text-indigo-600 hover:underline">
                      Ver mis metas →
                    </button>
                  ) : (
                    <button onClick={saveAsGoal}
                      className="text-xs font-semibold text-indigo-600 border border-indigo-200 bg-white hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition">
                      🎯 Guardar como meta
                    </button>
                  )}
                </div>
              </div>

              {/* Quick apply form */}
              {showApplyForm && !appliedId && session && (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-xs text-slate-500 shrink-0">¿Dónde la encontraste?</span>
                  <select
                    value={applySource}
                    onChange={e => setApplySource(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-200 transition"
                  >
                    {SOURCES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button
                    onClick={async () => {
                      const id = crypto.randomUUID();
                      const now = new Date().toISOString();
                      await supabase.from('applications').insert({
                        id, user_id: session.user.id,
                        company: form.company, position: form.position,
                        source: applySource, status: 'applied', applied_at: now,
                      });
                      setAppliedId(id);
                      setShowApplyForm(false);
                    }}
                    className="text-xs font-semibold text-white bg-sky-500 hover:bg-sky-600 px-3 py-1.5 rounded-lg transition"
                  >
                    Registrar
                  </button>
                  <button onClick={() => setShowApplyForm(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 transition">
                    Cancelar
                  </button>
                </div>
              )}
              {appliedId && (
                <p className="text-xs text-sky-600 font-medium">✓ Registrada en Postulaciones · {applySource}</p>
              )}
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 flex overflow-x-auto">
              <TabBtn active={activeTab === 'fit'} onClick={() => setActiveTab('fit')}>📊 Afinidad</TabBtn>
              <TabBtn active={activeTab === 'tips'} onClick={() => setActiveTab('tips')}>📝 Tips CV</TabBtn>
              <TabBtn active={activeTab === 'letter'} onClick={() => setActiveTab('letter')}>✉️ Carta</TabBtn>
              <TabBtn active={activeTab === 'autofill'} onClick={() => setActiveTab('autofill')}>🗂 Autollenado</TabBtn>
              <TabBtn active={activeTab === 'plan'} onClick={() => setActiveTab('plan')}>🎯 Plan</TabBtn>
            </div>

            <div className="p-6">

              {activeTab === 'fit' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <CircularScore score={result.fit_score} />
                    <div className="flex-1 space-y-2">
                      <h2 className="font-semibold text-slate-800">Resumen del ajuste</h2>
                      <p className="text-slate-600 text-sm leading-relaxed">{result.fit_summary}</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-emerald-700">✓ Fortalezas</h3>
                      <ul className="space-y-2">
                        {result.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="text-emerald-500 mt-0.5 shrink-0">●</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-amber-700">△ Áreas de mejora</h3>
                      {result.gaps.length === 0
                        ? <p className="text-sm text-slate-500 italic">Sin brechas significativas</p>
                        : <ul className="space-y-2">{result.gaps.map((g, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="text-amber-400 mt-0.5 shrink-0">●</span>{g}
                          </li>
                        ))}</ul>}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tips' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">Qué resaltar en tu CV para esta vacante:</p>
                  <ol className="space-y-3">
                    {result.cv_tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                        <p className="text-sm text-slate-700 leading-relaxed">{tip}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {activeTab === 'letter' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800">Carta de presentación</h2>
                    <CopyBtn text={result.cover_letter} />
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-serif">{result.cover_letter}</p>
                  </div>
                </div>
              )}

              {activeTab === 'autofill' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">Campos copiables para formularios:</p>
                  {(
                    [
                      { label: 'Nombre completo', key: 'name' },
                      { label: 'Email', key: 'email' },
                      { label: 'Teléfono', key: 'phone' },
                      { label: 'Ubicación', key: 'location' },
                      { label: 'Portfolio / Sitio web', key: 'portfolio' },
                      { label: 'Resumen profesional', key: 'summary' },
                      { label: '¿Por qué esta empresa?', key: 'why_company' },
                    ] as { label: string; key: keyof AutofillData }[]
                  ).map(({ label, key }) => (
                    <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
                        <CopyBtn text={result.autofill[key]} />
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{result.autofill[key]}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'plan' && (
                <div className="space-y-4">
                  {!learningPlan && !planLoading && (
                    <div className="text-center py-6 space-y-3">
                      <p className="text-slate-600 text-sm leading-relaxed max-w-sm mx-auto">
                        Genera un plan de capacitación personalizado para cubrir las brechas de esta vacante y convertirla en una meta alcanzable.
                      </p>
                      {planError && <p className="text-red-600 text-sm">{planError}</p>}
                      <button onClick={generatePlan}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all shadow-sm">
                        ✦ Generar plan de desarrollo
                      </button>
                    </div>
                  )}
                  {planLoading && <Spinner label="Creando tu plan de desarrollo…" />}
                  {learningPlan && <LearningPlanView plan={learningPlan} />}
                </div>
              )}

            </div>

            <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">Generado con IA — revisar antes de enviar</span>
              <button onClick={() => { setResult(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="text-xs text-slate-400 hover:text-slate-600 transition">
                Nueva búsqueda →
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
