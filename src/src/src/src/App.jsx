import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sprout, Droplets, Send, MessageCircle, MapPin, X, Check,
  ArrowRight, Search, Loader2, ChevronLeft, Users, LogOut
} from 'lucide-react';
import { supabase } from './supabaseClient.js';

/* ------------------------------------------------------------------ */
/*  Trust-Nexus — portail de mise en relation créateurs / investisseurs */
/*  pour soutenir la dynamique d'une Afrique nouvelle.                  */
/* ------------------------------------------------------------------ */

const SECTORS = ['Agritech', 'Fintech', 'Santé', 'Éducation', 'Commerce', 'Industrie', 'Tourisme', 'Énergie', 'Artisanat', 'Autre'];
const STAGES = ['Idée', 'Prototype', 'Lancé', 'En croissance'];
const CURRENCIES = ['GNF', 'USD', 'EUR'];

const PROFILE_STORAGE_KEY = 'trust-nexus-profile';
const LOGO_MARK = '/logo-mark.webp';
const LOGO_FULL = '/logo-full.webp';

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function formatAmount(n, currency) {
  const num = Number(n) || 0;
  try {
    return new Intl.NumberFormat('fr-FR').format(num) + ' ' + currency;
  } catch {
    return num + ' ' + currency;
  }
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days} j`;
}

/* --------------------------- Profil local ----------------------------- */

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveProfileLocal(profile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* le stockage local peut être bloqué (navigation privée, etc.) */
  }
}

function clearProfileLocal() {
  try { localStorage.removeItem(PROFILE_STORAGE_KEY); } catch { /* noop */ }
}

/* ----------------------------- Supabase --------------------------------- */

function mapProjectFromDb(p) {
  return {
    id: p.id, creatorId: p.creator_id, creatorName: p.creator_name, name: p.name,
    sector: p.sector, pitch: p.pitch, description: p.description || '',
    amountSought: p.amount_sought, currency: p.currency, stage: p.stage,
    city: p.city, videoLink: p.video_link || '', status: p.status, createdAt: p.created_at,
  };
}

function mapConnectionFromDb(c) {
  return {
    id: c.id, projectId: c.project_id, projectName: c.project_name,
    creatorId: c.creator_id, creatorName: c.creator_name,
    investorId: c.investor_id, investorName: c.investor_name,
    status: c.status, messages: c.messages || [], createdAt: c.created_at,
  };
}

async function fetchPlatformData() {
  const [{ data: projects, error: projErr }, { data: connections, error: connErr }] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('connections').select('*').order('created_at', { ascending: false }),
  ]);
  if (projErr) throw projErr;
  if (connErr) throw connErr;
  return {
    projects: (projects || []).map(mapProjectFromDb),
    connections: (connections || []).map(mapConnectionFromDb),
  };
}

async function insertProjectDb(project) {
  const { error } = await supabase.from('projects').insert([{
    id: project.id, creator_id: project.creatorId, creator_name: project.creatorName,
    name: project.name, sector: project.sector, pitch: project.pitch,
    description: project.description, amount_sought: Number(project.amountSought) || 0,
    currency: project.currency, stage: project.stage, city: project.city,
    video_link: project.videoLink, status: project.status, created_at: project.createdAt,
  }]);
  if (error) throw error;
}

async function insertConnectionDb(connection) {
  const { error } = await supabase.from('connections').insert([{
    id: connection.id, project_id: connection.projectId, project_name: connection.projectName,
    creator_id: connection.creatorId, creator_name: connection.creatorName,
    investor_id: connection.investorId, investor_name: connection.investorName,
    status: connection.status, messages: connection.messages, created_at: connection.createdAt,
  }]);
  if (error) throw error;
}

async function updateConnectionStatusDb(id, status) {
  const { error } = await supabase.from('connections').update({ status }).eq('id', id);
  if (error) throw error;
}

async function updateConnectionMessagesDb(id, messages) {
  const { error } = await supabase.from('connections').update({ messages }).eq('id', id);
  if (error) throw error;
}

const emptyData = () => ({ projects: [], connections: [] });

/* ------------------------------ Bits -------------------------------- */

function SectorPill({ sector }) {
  return (
    <span className="fonio-mono text-xs px-2 py-1 rounded-full border border-ardoise text-ardoise uppercase tracking-wide">
      {sector}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    'Publié': { color: '#4C9271', label: 'Publié' },
    'Brouillon': { color: '#9B9188', label: 'Brouillon' },
    'Financé': { color: '#DDA52E', label: 'Financé' },
  };
  const s = map[status] || map['Brouillon'];
  return (
    <span className="fonio-mono text-xs px-2 py-1 rounded-full" style={{ color: s.color, border: `1px solid ${s.color}55` }}>
      {s.label}
    </span>
  );
}

function ConnectionFlow({ status }) {
  const steps = ['Demande envoyée', 'Acceptée', 'En échange'];
  let activeIdx = status === 'pending' ? 0 : status === 'accepted' ? 2 : 0;
  if (status === 'declined') {
    return <span className="fonio-mono text-xs text-ardoise flex items-center gap-1"><X size={13} /> Déclinée</span>;
  }
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: i <= activeIdx ? '#C2491E' : '#382F26' }} />
          {i < steps.length - 1 && (
            <div className="h-px w-4" style={{ backgroundColor: i < activeIdx ? '#C2491E' : '#382F26' }} />
          )}
        </React.Fragment>
      ))}
      <span className="fonio-mono text-xs text-ardoise ml-1">{steps[activeIdx]}</span>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-laterite" size={28} />
    </div>
  );
}

/* ------------------------------ Hero --------------------------------- */

function Hero() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ardoise mb-8 px-6 py-10 sm:px-10 sm:py-14 bg-ink-raised">
      <svg className="absolute right-0 top-0 h-full w-1/2 opacity-40 pointer-events-none hidden sm:block" viewBox="0 0 300 400" fill="none" preserveAspectRatio="none">
        <path className="fonio-flow-path" d="M 260 0 C 180 60, 220 120, 140 170 C 60 220, 110 280, 40 340 C 10 365, 20 385, 0 400" stroke="#DDA52E" strokeWidth="2" fill="none" />
      </svg>
      <div className="relative">
        <p className="fonio-mono text-xs text-or uppercase tracking-widest mb-4">Guinée · mise en relation</p>
        <h1 className="fonio-display text-3xl sm:text-5xl leading-tight mb-4" style={{ fontWeight: 500 }}>
          Relier les créateurs<br /><em style={{ fontStyle: 'italic', color: '#C2491E' }}>aux investisseurs.</em>
        </h1>
        <p className="text-ardoise max-w-md text-sm sm:text-base leading-relaxed">
          Trust-Nexus est un site qui permet de relier les créateurs aux investisseurs. Il se présente comme un portail qui favorise la création et l'innovation pour soutenir la dynamique d'une Afrique nouvelle. Pas de transaction ici — seulement la bonne rencontre, au bon moment.
        </p>
      </div>
    </div>
  );
}

/* --------------------------- Onboarding ------------------------------ */

function Onboarding({ onDone }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [city, setCity] = useState('');

  const canSubmit = name.trim() && role && city.trim();

  const submit = () => {
    if (!canSubmit) return;
    const profile = { id: uid(), name: name.trim(), role, city: city.trim() };
    saveProfileLocal(profile);
    onDone(profile);
  };

  return (
    <div className="min-h-screen fonio-root flex items-center justify-center px-4">
      <div className="w-full max-w-sm fonio-rise">
        <div className="flex items-center justify-center mb-3">
          <img src={LOGO_FULL} alt="Trust-Nexus" className="h-24 w-auto" />
        </div>
        <p className="text-center fonio-display text-lg mb-8" style={{ fontStyle: 'italic', color: '#C2491E' }}>Un monde de confiance</p>

        <div className="space-y-4">
          <div>
            <label className="fonio-mono text-xs text-ardoise uppercase tracking-wide block mb-1.5">Nom</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Ibrahim Diallo" className="fonio-input w-full rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="fonio-mono text-xs text-ardoise uppercase tracking-wide block mb-1.5">Ville</label>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="Ex : Conakry" className="fonio-input w-full rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="fonio-mono text-xs text-ardoise uppercase tracking-wide block mb-2">Je suis</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setRole('Créateur')} className="rounded-lg px-3 py-3 text-sm flex flex-col items-center gap-2 fonio-btn-ghost" style={role === 'Créateur' ? { borderColor: '#C2491E', backgroundColor: '#1D1812' } : {}}>
                <Sprout size={18} className={role === 'Créateur' ? 'text-laterite' : 'text-ardoise'} />
                Créateur
              </button>
              <button onClick={() => setRole('Investisseur')} className="rounded-lg px-3 py-3 text-sm flex flex-col items-center gap-2 fonio-btn-ghost" style={role === 'Investisseur' ? { borderColor: '#C2491E', backgroundColor: '#1D1812' } : {}}>
                <Droplets size={18} className={role === 'Investisseur' ? 'text-laterite' : 'text-ardoise'} />
                Investisseur
              </button>
            </div>
          </div>
          <button onClick={submit} disabled={!canSubmit} className="fonio-btn-primary w-full rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-2 mt-2">
            Entrer <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Header -------------------------------- */

function Header({ profile, view, setView, onLogout }) {
  const nav = [
    { key: 'home', label: 'Découvrir' },
    ...(profile.role === 'Créateur' ? [{ key: 'create', label: 'Publier' }] : []),
    { key: 'echanges', label: 'Mes échanges' },
  ];
  return (
    <div className="sticky top-0 z-10 bg-ink border-b border-ardoise">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <button onClick={() => setView('home')} className="flex items-center gap-2">
          <img src={LOGO_MARK} alt="Trust-Nexus" className="h-7 w-auto" />
          <span className="fonio-display text-lg" style={{ fontWeight: 500 }}>Trust-Nexus</span>
        </button>
        <div className="flex items-center gap-1">
          {nav.map(n => (
            <button key={n.key} onClick={() => setView(n.key)} className="fonio-mono text-xs px-3 py-1.5 rounded-full uppercase tracking-wide" style={{ color: view === n.key ? '#14110D' : '#9B9188', backgroundColor: view === n.key ? '#DDA52E' : 'transparent' }}>
              {n.label}
            </button>
          ))}
          <button onClick={onLogout} title="Changer de profil" className="ml-1 p-2 text-ardoise hover:text-laterite">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Home ----------------------------------- */

function ProjectCard({ project, onOpen }) {
  return (
    <button onClick={() => onOpen(project.id)} className="fonio-card rounded-xl p-5 text-left w-full fonio-rise">
      <div className="flex items-start justify-between mb-3 gap-2">
        <SectorPill sector={project.sector} />
        <StatusBadge status={project.status} />
      </div>
      <h3 className="fonio-display text-lg mb-1.5" style={{ fontWeight: 500 }}>{project.name}</h3>
      <p className="text-ardoise text-sm mb-4 line-clamp-2">{project.pitch}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-ardoise"><MapPin size={12} /> {project.city}</span>
        <span className="fonio-mono text-or">{formatAmount(project.amountSought, project.currency)}</span>
      </div>
    </button>
  );
}

function Home({ data, profile, onOpen }) {
  const [sector, setSector] = useState('Tous');
  const [q, setQ] = useState('');

  const projects = data.projects
    .filter(p => p.status === 'Publié' || p.creatorId === profile.id)
    .filter(p => sector === 'Tous' || p.sector === sector)
    .filter(p => !q || (p.name + p.pitch).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Hero />
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ardoise" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un projet…" className="fonio-input w-full rounded-lg pl-9 pr-3 py-2.5 text-sm" />
        </div>
        <select value={sector} onChange={e => setSector(e.target.value)} className="fonio-input rounded-lg px-3 py-2.5 text-sm fonio-mono">
          <option>Tous</option>
          {SECTORS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-ardoise rounded-xl">
          <Sprout className="mx-auto mb-3 text-ardoise" size={24} />
          <p className="text-ardoise text-sm">Aucun projet ici pour l'instant.</p>
          {profile.role === 'Créateur' && <p className="text-ardoise text-sm mt-1">Soyez le premier à publier le vôtre.</p>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {projects.map(p => <ProjectCard key={p.id} project={p} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Create Project ------------------------------ */

function Field({ label, children }) {
  return (
    <div>
      <label className="fonio-mono text-xs text-ardoise uppercase tracking-wide block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function CreateProject({ profile, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: '', sector: SECTORS[0], pitch: '', description: '',
    amountSought: '', currency: 'GNF', stage: STAGES[0], city: profile.city,
    videoLink: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const canSubmit = form.name.trim() && form.pitch.trim() && form.amountSought;

  const submit = async (status) => {
    if (status === 'Publié' && !canSubmit) return;
    setSaving(true);
    try {
      await onSubmit({ ...form, status, id: uid(), creatorId: profile.id, creatorName: profile.name, createdAt: new Date().toISOString() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 fonio-rise">
      <button onClick={onCancel} className="flex items-center gap-1 text-ardoise text-sm mb-6"><ChevronLeft size={16} /> Retour</button>
      <h2 className="fonio-display text-2xl mb-1" style={{ fontWeight: 500 }}>Publier un projet</h2>
      <p className="text-ardoise text-sm mb-8">Présentez votre idée le plus clairement possible — c'est ce qu'un investisseur lira en premier.</p>

      <div className="space-y-5">
        <Field label="Nom du projet">
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex : Sili Solar — kits solaires pour zones rurales" className="fonio-input w-full rounded-lg px-3 py-2.5 text-sm" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Secteur">
            <select value={form.sector} onChange={e => set('sector', e.target.value)} className="fonio-input w-full rounded-lg px-3 py-2.5 text-sm fonio-mono">
              {SECTORS.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Stade">
            <select value={form.stage} onChange={e => set('stage', e.target.value)} className="fonio-input w-full rounded-lg px-3 py-2.5 text-sm fonio-mono">
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Pitch (une phrase)">
          <input maxLength={140} value={form.pitch} onChange={e => set('pitch', e.target.value)} placeholder="Ce que vous faites, en une phrase" className="fonio-input w-full rounded-lg px-3 py-2.5 text-sm" />
        </Field>

        <Field label="Description complète">
          <textarea rows={5} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Problème, solution, marché, équipe, avancement…" className="fonio-input w-full rounded-lg px-3 py-2.5 text-sm resize-none" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant recherché">
            <input type="number" min="0" value={form.amountSought} onChange={e => set('amountSought', e.target.value)} placeholder="0" className="fonio-input w-full rounded-lg px-3 py-2.5 text-sm fonio-mono" />
          </Field>
          <Field label="Devise">
            <select value={form.currency} onChange={e => set('currency', e.target.value)} className="fonio-input w-full rounded-lg px-3 py-2.5 text-sm fonio-mono">
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Ville">
          <input value={form.city} onChange={e => set('city', e.target.value)} className="fonio-input w-full rounded-lg px-3 py-2.5 text-sm" />
        </Field>

        <Field label="Lien vidéo (optionnel)">
          <input value={form.videoLink} onChange={e => set('videoLink', e.target.value)} placeholder="https://youtube.com/…" className="fonio-input w-full rounded-lg px-3 py-2.5 text-sm" />
        </Field>

        <div className="flex gap-3 pt-2">
          <button onClick={() => submit('Brouillon')} disabled={saving} className="fonio-btn-ghost rounded-lg px-4 py-2.5 text-sm flex-1">Enregistrer comme brouillon</button>
          <button onClick={() => submit('Publié')} disabled={!canSubmit || saving} className="fonio-btn-primary rounded-lg px-4 py-2.5 text-sm flex-1 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={15} /> : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Project Detail ------------------------------ */

function ProjectDetail({ project, profile, connections, onBack, onRequestConnection, onRespond }) {
  const isOwner = project.creatorId === profile.id;
  const myConnection = connections.find(c => c.projectId === project.id
