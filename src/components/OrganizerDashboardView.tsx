import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Edit3,
  Lock,
  Mail,
  Plus,
  Printer,
  Search,
  Settings,
  Trash2,
  Unlock,
  UserPlus,
  X,
} from 'lucide-react';
import { ISCAE_FILIERES, ISCAE_GROUPES } from '../types';
import type { EventSessionConfig, PresenceRecord } from '../types';
import {
  buildEmailSummary,
  formatTimePrecise,
  formatTimeShort,
  triggerCsvDownload,
} from '../utils/helpers';

interface OrganizerDashboardViewProps {
  session: EventSessionConfig;
  presences: PresenceRecord[];
  loading: boolean;
  wsConnected: boolean;
  connectedClients: number;
  onManualAdd: (data: {
    nom: string;
    filiere: string;
    groupe: string;
    grp?: string;
    matricule?: string;
    source: 'organisateur';
  }) => Promise<{ ok: boolean; error?: string }>;
  onUpdateRecord: (
    id: string,
    patch: {
      nom: string;
      filiere: string;
      groupe: string;
      grp?: string;
      matricule?: string;
      isOrganizer: boolean;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  onDeleteRecord: (id: string) => Promise<boolean>;
  onClearAll: () => Promise<boolean>;
  onUpdateSession: (patch: Partial<EventSessionConfig>) => Promise<boolean>;
}

type SortOption = 'recent' | 'alpha' | 'filiere';

export const OrganizerDashboardView: React.FC<OrganizerDashboardViewProps> = ({
  session,
  presences,
  loading,
  wsConnected,
  connectedClients,
  onManualAdd,
  onUpdateRecord,
  onDeleteRecord,
  onClearAll,
  onUpdateSession,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filiereFilter, setFiliereFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  // Inline states (zero window.confirm / window.alert)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNom, setEditNom] = useState('');
  const [editGrp, setEditGrp] = useState('');
  const [editMatricule, setEditMatricule] = useState('');

  // Panels / Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Manual Add Form State
  const [addNom, setAddNom] = useState('');
  const [addFiliere, setAddFiliere] = useState<string>('1LSG');
  const [addGroupe, setAddGroupe] = useState<string>('Groupe 1');
  const [addMatricule, setAddMatricule] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addingBusy, setAddingBusy] = useState(false);

  // Settings Form State
  const [cfgTitle, setCfgTitle] = useState(session.title);
  const [cfgLocation, setCfgLocation] = useState(session.location);
  const [cfgDateLabel, setCfgDateLabel] = useState(session.dateLabel);
  const [cfgEmail, setCfgEmail] = useState(session.recipientEmail);
  const [cfgCapacity, setCfgCapacity] = useState(String(session.capacity));
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Email Copy Feedback
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Derived Analytics
  const filiereBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of presences) {
      const key = p.filiere || 'Autre';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [presences]);

  const topFiliere = filiereBreakdown[0] || null;
  const latestPresence = presences[0] || null;

  // 6-bucket arrival cadence chart (10-min intervals over the last 60 mins)
  const cadenceBuckets = useMemo(() => {
    const now = Date.now();
    const bucketMs = 10 * 60 * 1000;
    const buckets = [0, 0, 0, 0, 0, 0];
    for (const p of presences) {
      const age = now - p.ts;
      if (age >= 0 && age < 6 * bucketMs) {
        const idx = 5 - Math.min(5, Math.floor(age / bucketMs));
        buckets[idx]++;
      }
    }
    return buckets;
  }, [presences]);

  const maxBucket = Math.max(1, ...cadenceBuckets);
  const recent15MinCount = useMemo(() => {
    const cutoff = Date.now() - 15 * 60 * 1000;
    return presences.filter((p) => p.ts >= cutoff).length;
  }, [presences]);

  const filteredPresences = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = presences.filter((p) => {
      if (filiereFilter !== 'ALL' && p.filiere !== filiereFilter) return false;
      if (!q) return true;
      const haystack = `${p.nom} ${p.grp} ${p.code} ${p.matricule || ''}`.toLowerCase();
      return haystack.includes(q);
    });

    if (sortBy === 'alpha') {
      return [...list].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    }
    if (sortBy === 'filiere') {
      return [...list].sort(
        (a, b) => a.grp.localeCompare(b.grp, 'fr') || a.nom.localeCompare(b.nom, 'fr')
      );
    }
    return [...list].sort((a, b) => b.ts - a.ts);
  }, [presences, filiereFilter, searchQuery, sortBy]);

  const emailData = useMemo(
    () => buildEmailSummary(presences, session),
    [presences, session]
  );

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const cleanNom = addNom.trim();
    if (cleanNom.length < 3) {
      setAddError('Veuillez saisir le nom et prénom (au moins 3 caractères).');
      return;
    }
    setAddingBusy(true);
    const res = await onManualAdd({
      nom: cleanNom,
      filiere: addFiliere,
      groupe: addGroupe,
      grp: `${addFiliere}, ${addGroupe}`,
      matricule: addMatricule.trim(),
      source: 'organisateur',
    });
    setAddingBusy(false);
    if (!res.ok) {
      setAddError(res.error || 'Erreur lors de l’ajout.');
      return;
    }
    setAddNom('');
    setAddMatricule('');
    setShowAddModal(false);
  }

  function startInlineEdit(record: PresenceRecord) {
    setEditingId(record.id);
    setEditNom(record.nom);
    setEditGrp(record.grp);
    setEditMatricule(record.matricule || '');
    setConfirmDeleteId(null);
  }

  async function saveInlineEdit(record: PresenceRecord) {
    if (editNom.trim().length < 3) return;
    await onUpdateRecord(record.id, {
      nom: editNom.trim(),
      filiere: record.filiere,
      groupe: record.groupe,
      grp: editGrp.trim() || record.grp,
      matricule: editMatricule.trim(),
      isOrganizer: true,
    });
    setEditingId(null);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    const cap = Math.max(10, Math.min(5000, parseInt(cfgCapacity, 10) || 160));
    await onUpdateSession({
      title: cfgTitle.trim() || session.title,
      location: cfgLocation.trim() || session.location,
      dateLabel: cfgDateLabel.trim() || session.dateLabel,
      recipientEmail: cfgEmail.trim() || session.recipientEmail,
      capacity: cap,
    });
    setSettingsSaved(true);
    setTimeout(() => {
      setSettingsSaved(false);
      setShowSettingsModal(false);
    }, 900);
  }

  function openSettings() {
    setCfgTitle(session.title);
    setCfgLocation(session.location);
    setCfgDateLabel(session.dateLabel);
    setCfgEmail(session.recipientEmail);
    setCfgCapacity(String(session.capacity));
    setConfirmClearAll(false);
    setShowSettingsModal(true);
  }

  return (
    <div className="space-y-6">
      {/* Workspace Action Toolbar (Hidden in print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Console Organisateur
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {wsConnected ? 'Synchronisation temps réel active' : 'Reconnexion en cours…'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {connectedClients} terminal{connectedClients > 1 ? 'x' : ''} connecté{connectedClients > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#233886] hover:bg-[#1B2C6B] dark:bg-[#6E8BFF] dark:text-[#080D21] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Ajouter un présent</span>
          </button>

          <button
            type="button"
            onClick={() => setShowEmailModal(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#13192E] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Envoyer par e-mail</span>
          </button>

          <button
            type="button"
            onClick={() => triggerCsvDownload(presences)}
            disabled={presences.length === 0}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#13192E] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#13192E] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer liste</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSession({ isOpen: !session.isOpen })}
            className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              session.isOpen
                ? 'border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                : 'border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            {session.isOpen ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Clôturer</span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>Rouvrir</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={openSettings}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#13192E] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Paramètres de la séance et réinitialisation"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Paramètres</span>
          </button>
        </div>
      </div>

      {/* Single-Elevation 4-Metric KPI Strip (Hidden in print) */}
      <section className="bg-white dark:bg-[#13192E] border border-slate-200/90 dark:border-slate-800 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-slate-800 no-print">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Effectif présent
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold tabular-nums text-[#233886] dark:text-[#7C96FF]">
              {presences.length}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              / {session.capacity} places (
              {Math.round((presences.length / Math.max(1, session.capacity)) * 100)}%)
            </span>
          </div>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Filière la plus représentée
          </p>
          <div className="mt-2">
            {topFiliere ? (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 truncate">
                  {topFiliere[0]}
                </span>
                <span className="text-sm font-mono font-semibold tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                  {topFiliere[1]} inscrit{topFiliere[1] > 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <span className="text-sm text-slate-400">Aucune donnée</span>
            )}
          </div>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Dernier émargement
          </p>
          <div className="mt-2">
            {latestPresence ? (
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {latestPresence.nom}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                  {formatTimePrecise(latestPresence.ts)} · {latestPresence.grp}
                </p>
              </div>
            ) : (
              <span className="text-sm text-slate-400">En attente…</span>
            )}
          </div>
        </div>

        <div className="p-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Cadence (15 dern. min)
            </p>
            <p className="mt-2 text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
              +{recent15MinCount}
            </p>
          </div>
          {/* Crisp SVG Arrival Histogram */}
          <svg
            width="84"
            height="36"
            viewBox="0 0 84 36"
            className="shrink-0 overflow-visible"
            aria-label="Histogramme des arrivées sur 60 minutes"
          >
            {cadenceBuckets.map((val, idx) => {
              const barH = Math.max(4, Math.round((val / maxBucket) * 32));
              const x = idx * 14;
              const y = 36 - barH;
              return (
                <rect
                  key={idx}
                  x={x}
                  y={y}
                  width="10"
                  height={barH}
                  rx="2"
                  className={
                    val > 0
                      ? 'fill-[#233886] dark:fill-[#6E8BFF]'
                      : 'fill-slate-200 dark:fill-slate-800'
                  }
                />
              );
            })}
          </svg>
        </div>
      </section>

      {/* Main Attendance Ledger Container */}
      <section className="bg-white dark:bg-[#13192E] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden">
        {/* Filter & Search Bar (Hidden in print) */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 space-y-4 no-print">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Interactive Segmented Filière Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0B0F1E] rounded-xl overflow-x-auto">
              <button
                type="button"
                onClick={() => setFiliereFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filiereFilter === 'ALL'
                    ? 'bg-white dark:bg-[#1C2544] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Toutes ({presences.length})
              </button>
              {filiereBreakdown.map(([fil, count]) => (
                <button
                  key={fil}
                  type="button"
                  onClick={() => setFiliereFilter(fil)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filiereFilter === fil
                      ? 'bg-white dark:bg-[#1C2544] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {fil} ({count})
                </button>
              ))}
            </div>

            {/* Search + Sort */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un étudiant, groupe, code…"
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#233886]"
                />
              </div>

              <select
                aria-label="Trier la liste"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="h-9 px-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#233886]"
              >
                <option value="recent">Tri : Plus récents</option>
                <option value="alpha">Tri : Alphabétique (A–Z)</option>
                <option value="filiere">Tri : Par filière / groupe</option>
              </select>
            </div>
          </div>
        </div>

        {/* Print-Only Official Academic Header */}
        <div className="hidden print:block p-6 border-b border-black">
          <p className="text-xs uppercase tracking-wider">
            Université de la Manouba · ISCAE Manouba
          </p>
          <h2 className="text-xl font-bold mt-1">
            Feuille d’Émargement Officielle — {session.title}
          </h2>
          <p className="text-xs mt-1">
            Date : {session.dateLabel} · Lieu : {session.location} · Total présents :{' '}
            {filteredPresences.length}
          </p>
        </div>

        {/* High-Density Attendance Table */}
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800/50 animate-pulse"
              />
            ))}
          </div>
        ) : filteredPresences.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {presences.length === 0
                ? 'Aucune présence enregistrée pour cette séance'
                : 'Aucun étudiant ne correspond aux filtres sélectionnés'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {presences.length === 0
                ? 'Projetez le QR Code en amphithéâtre ou ajoutez manuellement un participant pour démarrer l’émargement.'
                : 'Modifiez votre recherche ou sélectionnez « Toutes » les filières.'}
            </p>
            {presences.length === 0 && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#233886] text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Enregistrer le premier présent</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-[#0F1427]">
                  <th className="py-3 pl-5 pr-2 w-12 font-mono">#</th>
                  <th className="py-3 px-3">Nom et Prénom</th>
                  <th className="py-3 px-3">Filière &amp; Groupe</th>
                  <th className="py-3 px-3">Matricule</th>
                  <th className="py-3 px-3">Code Reçu</th>
                  <th className="py-3 px-3 text-right">Heure</th>
                  <th className="py-3 pl-3 pr-5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80 text-sm">
                {filteredPresences.map((r, index) => {
                  const isEditing = editingId === r.id;
                  const isConfirmingDelete = confirmDeleteId === r.id;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-2.5 pl-5 pr-2 font-mono text-xs tabular-nums text-slate-400">
                        {String(index + 1).padStart(2, '0')}
                      </td>

                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNom}
                            onChange={(e) => setEditNom(e.target.value)}
                            className="w-full h-8 px-2.5 rounded-lg bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-600 text-xs"
                          />
                        ) : (
                          <div>
                            <span>{r.nom}</span>
                            {r.source === 'organisateur' && (
                              <span className="ml-2 text-[11px] font-normal text-slate-400">
                                · Saisie org.
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-slate-300">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editGrp}
                            onChange={(e) => setEditGrp(e.target.value)}
                            className="w-full h-8 px-2.5 rounded-lg bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-600 text-xs"
                          />
                        ) : (
                          r.grp
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editMatricule}
                            onChange={(e) => setEditMatricule(e.target.value)}
                            placeholder="—"
                            className="w-24 h-8 px-2 rounded-lg bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-600 text-xs font-mono"
                          />
                        ) : (
                          r.matricule || '—'
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-xs font-semibold tabular-nums text-[#233886] dark:text-[#7C96FF]">
                        {r.code}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatTimeShort(r.ts)}
                      </td>

                      <td className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap no-print">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveInlineEdit(r)}
                              className="px-2.5 py-1 rounded-lg bg-[#233886] text-white text-xs font-semibold cursor-pointer"
                            >
                              Enregistrer
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : isConfirmingDelete ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteRecord(r.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              Confirmer retrait
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startInlineEdit(r)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
                              title="Modifier cette ligne"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(r.id)}
                              className="px-2 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                              title="Retirer cette présence"
                            >
                              Retirer
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Print-Only Academic Signature Block */}
        <div className="hidden print:flex justify-between items-start p-8 border-t border-black text-xs mt-6">
          <div>
            <p className="font-semibold">Comité d’Organisation Management &amp; Marketing</p>
            <p className="text-slate-600 mt-1">ISCAE · Campus Universitaire de la Manouba</p>
          </div>
          <div className="w-56 border-t border-black pt-2 text-center">
            Visa &amp; Signature du Responsable
          </div>
        </div>
      </section>

      {/* Modal: Manual Student Add */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-[#13192E] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-50">
                Ajout manuel d’un présent
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nom et prénom de l’étudiant(e)
                </label>
                <input
                  type="text"
                  required
                  value={addNom}
                  onChange={(e) => setAddNom(e.target.value)}
                  placeholder="Ex. Kallel Mariem"
                  className="w-full h-10 px-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Filière
                  </label>
                  <select
                    value={addFiliere}
                    onChange={(e) => setAddFiliere(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm"
                  >
                    {ISCAE_FILIERES.map((f) => (
                      <option key={f.id} value={f.label}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Groupe
                  </label>
                  <select
                    value={addGroupe}
                    onChange={(e) => setAddGroupe(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm"
                  >
                    {ISCAE_GROUPES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  N° Carte Étudiant (optionnel)
                </label>
                <input
                  type="text"
                  value={addMatricule}
                  onChange={(e) => setAddMatricule(e.target.value)}
                  placeholder="Ex. 2301410"
                  className="w-full h-10 px-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm font-mono"
                />
              </div>

              {addError && <p className="text-xs text-red-600">{addError}</p>}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={addingBusy}
                  className="h-10 px-5 rounded-xl bg-[#233886] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {addingBusy ? 'Ajout…' : 'Enregistrer la présence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Send by Email & Copy Official Summary */}
      {showEmailModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-[#13192E] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-50">
                  Transmettre la liste des présences par e-mail
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Destinataire configuré :{' '}
                  <span className="font-mono text-slate-700 dark:text-slate-200">
                    {session.recipientEmail}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Aperçu intégral du rapport ({presences.length} présent{presences.length > 1 ? 's' : ''})
              </label>
              <textarea
                readOnly
                rows={9}
                value={emailData.fullBody}
                className="w-full p-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none"
              />
              {emailData.isTruncatedInMailto && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                  Remarque : la liste dépasse la limite des liens mailto automatiques. Copiez le rapport complet ou téléchargez le fichier CSV pour le joindre à votre e-mail.
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(emailData.fullBody);
                    setCopiedSummary(true);
                    setTimeout(() => setCopiedSummary(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Rapport copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copier tout le texte</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => triggerCsvDownload(presences)}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger CSV</span>
                </button>
              </div>

              <a
                href={emailData.mailtoHref}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#233886] hover:bg-[#1B2C6B] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <Mail className="w-4 h-4" />
                <span>Ouvrir dans la messagerie</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Session Settings & Reset */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-[#13192E] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-50">
                Paramètres de l’événement
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Intitulé de l’événement
                </label>
                <input
                  type="text"
                  value={cfgTitle}
                  onChange={(e) => setCfgTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Salle / Amphithéâtre
                </label>
                <input
                  type="text"
                  value={cfgLocation}
                  onChange={(e) => setCfgLocation(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date affichée
                  </label>
                  <input
                    type="text"
                    value={cfgDateLabel}
                    onChange={(e) => setCfgDateLabel(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Capacité cible (places)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    value={cfgCapacity}
                    onChange={(e) => setCfgCapacity(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  E-mail destinataire du rapport officiel
                </label>
                <input
                  type="email"
                  value={cfgEmail}
                  onChange={(e) => setCfgEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm font-mono"
                />
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                {!confirmClearAll ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vider la liste (Nouvelle séance)</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await onClearAll();
                        setConfirmClearAll(false);
                        setShowSettingsModal(false);
                      }}
                      className="h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      Confirmer la suppression totale
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="text-xs text-slate-500 cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                  >
                    Fermer
                  </button>
                  <button
                    type="submit"
                    className="h-10 px-5 rounded-xl bg-[#233886] text-white text-xs font-semibold cursor-pointer"
                  >
                    {settingsSaved ? 'Enregistré ✓' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
