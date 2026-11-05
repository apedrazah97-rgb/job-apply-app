'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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
}

type AppView = 'analyze' | 'profile' | 'goals';
type ResultTab = 'fit' | 'tips' | 'letter' | 'autofill' | 'plan';

// ── Storage helpers ───────────────────────────────────────────────────────────

const KEYS = {
  profiles: 'jaa_profiles',
  currentProfile: 'jaa_current_profile',
  goals: (id: string) => `jaa_goals_${id}`,
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

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

// ── Profile Form ──────────────────────────────────────────────────────────────

function ProfileForm({ initial, onSave, onCancel }: {
  initial?: Partial<UserProfile>;
  onSave: (p: UserProfile) => void;
  onCancel?: () => void;
}) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, id: initial?.id ?? crypto.randomUUID() });
  };

  const inputClass = "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition placeholder:text-slate-400";
  const textareaClass = `${inputClass} resize-none font-mono leading-relaxed`;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
          placeholder="QA & Compliance Lead — QBridge AI&#10;Liderazgo de procesos de QA para plataformas de IA en entornos regulados.&#10;&#10;PM SAP — Avant Santé Research Center&#10;Gestión de proyectos con ERP SAP en contexto de investigación clínica."
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

// ── Learning Plan display ─────────────────────────────────────────────────────

function LearningPlanView({ plan }: { plan: LearningPlan }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
        <span className="text-2xl">🎯</span>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Duración estimada</span>
            <span className="text-sm font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">{plan.timeline}</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{plan.objective}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Fases del plan</h3>
        {plan.phases.map((phase, i) => (
          <div key={i} className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </span>
              <div>
                <span className="text-sm font-semibold text-slate-800">{phase.name}</span>
                <span className="ml-2 text-xs text-slate-400">{phase.duration}</span>
              </div>
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-slate-500 italic">{phase.goal}</p>
              <ul className="space-y-1.5">
                {phase.actions.map((a, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-indigo-400 mt-0.5 shrink-0">→</span>{a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

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

function GoalsView({ profileId, onBack }: { profileId: string; onBack: () => void }) {
  const [goals, setGoals] = useState<SavedGoal[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState<string | null>(null);
  const [planError, setPlanError] = useState('');

  useEffect(() => {
    setGoals(readStorage<SavedGoal[]>(KEYS.goals(profileId), []));
  }, [profileId]);

  const deleteGoal = (id: string) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated);
    writeStorage(KEYS.goals(profileId), updated);
    if (expanded === id) setExpanded(null);
  };

  const generatePlan = async (goal: SavedGoal) => {
    setGeneratingPlan(goal.id);
    setPlanError('');
    try {
      const profiles = readStorage<UserProfile[]>(KEYS.profiles, []);
      const profile = profiles.find(p => p.id === profileId);
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
      const updated = goals.map(g => g.id === goal.id ? { ...g, learningPlan: data } : g);
      setGoals(updated);
      writeStorage(KEYS.goals(profileId), updated);
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
          {goals.map(goal => (
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
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(goal.savedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
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
                    <LearningPlanView plan={goal.learningPlan} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [view, setView] = useState<AppView>('analyze');
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [newProfileMode, setNewProfileMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [form, setForm] = useState({ company: '', position: '', language: 'es', description: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>('fit');
  const [error, setError] = useState('');
  const [savedGoalId, setSavedGoalId] = useState<string | null>(null);

  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Load from localStorage once mounted
  useEffect(() => {
    const stored = readStorage<UserProfile[]>(KEYS.profiles, []);
    const currentId = readStorage<string | null>(KEYS.currentProfile, null);
    setProfiles(stored);
    setCurrentProfileId(currentId && stored.find(p => p.id === currentId) ? currentId : stored[0]?.id ?? null);
    setHydrated(true);
  }, []);

  const currentProfile = profiles.find(p => p.id === currentProfileId) ?? null;
  const noProfile = hydrated && profiles.length === 0;

  const saveProfile = (p: UserProfile) => {
    const isNew = !profiles.find(x => x.id === p.id);
    const updated = isNew ? [...profiles, p] : profiles.map(x => x.id === p.id ? p : x);
    setProfiles(updated);
    setCurrentProfileId(p.id);
    writeStorage(KEYS.profiles, updated);
    writeStorage(KEYS.currentProfile, p.id);
    setEditingProfile(false);
    setView('analyze');
  };

  const switchProfile = (id: string) => {
    setCurrentProfileId(id);
    writeStorage(KEYS.currentProfile, id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !form.description.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');
    setLearningPlan(null);
    setSavedGoalId(null);
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

  const saveAsGoal = useCallback(() => {
    if (!result || !currentProfile) return;
    const goal: SavedGoal = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      profileId: currentProfile.id,
      company: form.company,
      position: form.position,
      language: form.language,
      analysis: result,
      learningPlan: learningPlan ?? undefined,
    };
    const existing = readStorage<SavedGoal[]>(KEYS.goals(currentProfile.id), []);
    writeStorage(KEYS.goals(currentProfile.id), [goal, ...existing]);
    setSavedGoalId(goal.id);
  }, [result, currentProfile, form, learningPlan]);

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

  if (!hydrated) return null;

  // ── Profile setup (first time or editing) ──
  if (noProfile || editingProfile || newProfileMode) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <header className="text-center space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-900">
              {noProfile ? 'Crea tu perfil' : 'Editar perfil'}
            </h1>
            <p className="text-slate-500 text-sm">
              Esta info se usa como contexto para generar tu aplicación — sin tokens extra por re-enviarlo
            </p>
          </header>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <ProfileForm
              initial={newProfileMode ? undefined : (editingProfile && currentProfile ? currentProfile : undefined)}
              onSave={(p) => { setNewProfileMode(false); saveProfile(p); }}
              onCancel={(editingProfile || newProfileMode) ? () => { setEditingProfile(false); setNewProfileMode(false); } : undefined}
            />
          </div>
        </div>
      </main>
    );
  }

  // ── Goals view ──
  if (view === 'goals' && currentProfile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <GoalsView profileId={currentProfile.id} onBack={() => setView('analyze')} />
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
              Powered by Ollama · 100% local
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Job Apply Assistant</h1>
          </div>

          {/* Profile + nav */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setView('goals')}
              className="text-xs font-medium text-slate-500 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-50 transition">
              🎯 Mis metas
            </button>
            <div className="relative group">
              <button className="flex items-center gap-2 text-xs font-semibold text-slate-700 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                  {currentProfile?.name[0]?.toUpperCase()}
                </span>
                <span className="max-w-[80px] truncate">{currentProfile?.name}</span>
                <span className="text-slate-400">▾</span>
              </button>
              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-50">
                {profiles.map(p => (
                  <button key={p.id} onClick={() => switchProfile(p.id)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-50 transition ${p.id === currentProfileId ? 'text-indigo-600 font-semibold' : 'text-slate-700'}`}>
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {p.name[0]?.toUpperCase()}
                    </span>
                    <span className="truncate">{p.name}</span>
                    {p.id === currentProfileId && <span className="ml-auto text-indigo-400">✓</span>}
                  </button>
                ))}
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button onClick={() => setEditingProfile(true)}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 transition">
                    ✏️ Editar perfil
                  </button>
                  <button onClick={() => setNewProfileMode(true)}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 transition">
                    ＋ Nuevo perfil
                  </button>
                </div>
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
                  value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
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
              <label className="block text-sm font-medium text-slate-700">Descripción de la vacante *</label>
              <textarea rows={8} required
                placeholder="Pega aquí el texto completo de la oferta — requisitos, responsabilidades, descripción de la empresa…"
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

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <Spinner label="Analizando vacante con IA…" />
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div ref={resultsRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Save as goal banner */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {savedGoalId ? '✓ Guardado en Mis metas' : '¿Te gustaría desarrollarte para tener un trabajo así?'}
              </p>
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

            {/* Tabs */}
            <div className="border-b border-slate-200 flex overflow-x-auto">
              <TabBtn active={activeTab === 'fit'} onClick={() => setActiveTab('fit')}>📊 Afinidad</TabBtn>
              <TabBtn active={activeTab === 'tips'} onClick={() => setActiveTab('tips')}>📝 Tips CV</TabBtn>
              <TabBtn active={activeTab === 'letter'} onClick={() => setActiveTab('letter')}>✉️ Carta</TabBtn>
              <TabBtn active={activeTab === 'autofill'} onClick={() => setActiveTab('autofill')}>🗂 Autollenado</TabBtn>
              <TabBtn active={activeTab === 'plan'} onClick={() => setActiveTab('plan')}>🎯 Plan</TabBtn>
            </div>

            <div className="p-6">

              {/* Afinidad */}
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

              {/* Tips CV */}
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

              {/* Carta */}
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

              {/* Autollenado */}
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

              {/* Plan de desarrollo */}
              {activeTab === 'plan' && (
                <div className="space-y-4">
                  {!learningPlan && !planLoading && (
                    <div className="text-center py-6 space-y-3">
                      <p className="text-slate-600 text-sm leading-relaxed max-w-sm mx-auto">
                        Genera un plan de capacitación personalizado para cubrir las brechas de esta vacante y convertirla en una meta alcanzable.
                      </p>
                      {planError && (
                        <p className="text-red-600 text-sm">{planError}</p>
                      )}
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
              <span className="text-xs text-slate-400">Generado con Ollama (local) — revisar antes de enviar</span>
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
