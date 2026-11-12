import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Lock,
  Printer,
  Edit3,
  RotateCcw,
  KeyRound,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { ISCAE_FILIERES, ISCAE_GROUPES } from '../types';
import type { EventSessionConfig, PresenceRecord } from '../types';
import { formatDateTimeFull, formatTimePrecise, verifyAdminCode } from '../utils/helpers';
import { QrCodeCanvas } from './QrCodeCanvas';

interface StudentCheckInViewProps {
  session: EventSessionConfig;
  myReceipt: PresenceRecord | null;
  isStudentOnlyLink: boolean;
  isOrganizerUnlocked: boolean;
  onCheckIn: (data: {
    nom: string;
    filiere: string;
    groupe: string;
    grp?: string;
    matricule?: string;
  }) => Promise<{ ok: boolean; record?: PresenceRecord; alreadyRegistered?: boolean; error?: string }>;
  onUpdateOwnReceipt: (
    id: string,
    data: { nom: string; filiere: string; groupe: string; grp?: string; matricule?: string }
  ) => Promise<{ ok: boolean; record?: PresenceRecord; error?: string }>;
  onAdminUnlocked: () => void;
  onSimulateNewDevice: () => void;
  onOpenAmphitheater: () => void;
}

export const StudentCheckInView: React.FC<StudentCheckInViewProps> = ({
  session,
  myReceipt,
  isStudentOnlyLink,
  isOrganizerUnlocked,
  onCheckIn,
  onUpdateOwnReceipt,
  onAdminUnlocked,
  onSimulateNewDevice,
  onOpenAmphitheater,
}) => {
  const [nom, setNom] = useState('');
  const [selectedFiliere, setSelectedFiliere] = useState<string>('1LSG');
  const [customFiliere, setCustomFiliere] = useState('');
  const [selectedGroupe, setSelectedGroupe] = useState<string>('Groupe 1');
  const [customGroupe, setCustomGroupe] = useState('');
  const [useCustomGrpMode, setUseCustomGrpMode] = useState(false);
  const [matricule, setMatricule] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [alreadyNotice, setAlreadyNotice] = useState(false);

  // Edit mode for a student who just checked in (within 10-min grace window)
  const [isEditingReceipt, setIsEditingReceipt] = useState(false);

  // Admin code unlock drawer (for student-only shared link)
  const [showAdminGate, setShowAdminGate] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const studentCheckInUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}?view=pointage`;
  }, []);

  const canEditReceipt = useMemo(() => {
    if (!myReceipt) return false;
    return Date.now() - myReceipt.ts <= 10 * 60 * 1000;
  }, [myReceipt]);

  function startEditingReceipt() {
    if (!myReceipt) return;
    setNom(myReceipt.nom);
    const matchedFil = ISCAE_FILIERES.find((f) => f.label === myReceipt.filiere);
    if (matchedFil) {
      setSelectedFiliere(matchedFil.label);
      setUseCustomGrpMode(false);
    } else {
      setUseCustomGrpMode(true);
      setCustomFiliere(myReceipt.grp);
    }
    if (ISCAE_GROUPES.includes(myReceipt.groupe as (typeof ISCAE_GROUPES)[number])) {
      setSelectedGroupe(myReceipt.groupe);
      setCustomGroupe('');
    } else {
      setCustomGroupe(myReceipt.groupe);
    }
    setMatricule(myReceipt.matricule || '');
    setFormError(null);
    setIsEditingReceipt(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const cleanNom = nom.trim().replace(/\s+/g, ' ');
    if (cleanNom.length < 3 || !cleanNom.includes(' ')) {
      setFormError('Veuillez saisir votre nom et prénom complets (ex. Ben Salah Ahmed).');
      return;
    }

    const filiereVal = useCustomGrpMode
      ? customFiliere.trim()
      : selectedFiliere === 'Autre'
      ? customFiliere.trim() || 'Autre'
      : selectedFiliere;

    const groupeVal = useCustomGrpMode
      ? ''
      : customGroupe.trim() || selectedGroupe;

    const combinedGrp = useCustomGrpMode
      ? customFiliere.trim()
      : [filiereVal, groupeVal].filter(Boolean).join(', ');

    if (!combinedGrp) {
      setFormError('Veuillez préciser votre filière et votre groupe.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditingReceipt && myReceipt) {
        const res = await onUpdateOwnReceipt(myReceipt.id, {
          nom: cleanNom,
          filiere: filiereVal,
          groupe: groupeVal,
          grp: combinedGrp,
          matricule: matricule.trim(),
        });
        if (!res.ok) {
          setFormError(res.error || 'Modification impossible.');
        } else {
          setIsEditingReceipt(false);
        }
      } else {
        const res = await onCheckIn({
          nom: cleanNom,
          filiere: filiereVal,
          groupe: groupeVal,
          grp: combinedGrp,
          matricule: matricule.trim(),
        });
        if (!res.ok) {
          setFormError(res.error || 'Échec de l’enregistrement.');
        } else if (res.alreadyRegistered) {
          setAlreadyNotice(true);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdminUnlock(e: React.FormEvent) {
    e.preventDefault();
    setAdminError(null);
    const valid = await verifyAdminCode(adminCodeInput);
    if (valid) {
      setAdminCodeInput('');
      setShowAdminGate(false);
      onAdminUnlocked();
    } else {
      setAdminError('Code d’accès administrateur incorrect.');
    }
  }

  function handleCopyCode(code: string) {
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Main Form / Digital Receipt Column */}
      <div className="lg:col-span-7 bg-white dark:bg-[#13192E] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
        {myReceipt && !isEditingReceipt ? (
          <div>
            <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-50">
                    Présence confirmée et enregistrée
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    {alreadyNotice
                      ? 'Cet appareil a déjà validé son pointage pour cette séance.'
                      : 'Conservez ce récépissé numérique comme justificatif officiel.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Clean Academic Definition List (no nested card) */}
            <dl className="divide-y divide-slate-200/80 dark:divide-slate-800 text-sm my-4">
              <div className="py-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-slate-500 dark:text-slate-400">Étudiant(e)</dt>
                <dd className="font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                  {myReceipt.nom}
                </dd>
              </div>
              <div className="py-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-slate-500 dark:text-slate-400">Filière &amp; Groupe</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100 sm:text-right">
                  {myReceipt.grp}
                </dd>
              </div>
              {myReceipt.matricule && (
                <div className="py-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <dt className="text-slate-500 dark:text-slate-400">N° Carte Étudiant</dt>
                  <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100 sm:text-right">
                    {myReceipt.matricule}
                  </dd>
                </div>
              )}
              <div className="py-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-slate-500 dark:text-slate-400">Horodatage officiel</dt>
                <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100 sm:text-right">
                  {formatDateTimeFull(myReceipt.ts)}
                </dd>
              </div>
              <div className="py-3.5 flex items-center justify-between gap-2">
                <dt className="text-slate-500 dark:text-slate-400">Code de vérification</dt>
                <dd className="flex items-center gap-2">
                  <span className="font-mono font-semibold tabular-nums text-base text-[#233886] dark:text-[#7C96FF]">
                    {myReceipt.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(myReceipt.code)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg transition-colors"
                    title="Copier le code de vérification"
                  >
                    {copiedCode ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </dd>
              </div>
            </dl>

            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center gap-3 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-[#233886] text-white hover:bg-[#1B2C6B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer le justificatif</span>
              </button>

              {canEditReceipt && (
                <button
                  type="button"
                  onClick={startEditingReceipt}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Corriger mes informations</span>
                </button>
              )}

              {isOrganizerUnlocked && (
                <button
                  type="button"
                  onClick={onSimulateNewDevice}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer ml-auto"
                  title="Mode test organisateur : réinitialiser le verrou local pour enregistrer un autre étudiant sur cet appareil"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tester un autre pointage</span>
                </button>
              )}
            </div>
          </div>
        ) : !session.isOpen && !isEditingReceipt ? (
          <div className="py-10 text-center max-w-md mx-auto">
            <Lock className="w-10 h-10 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-50">
              Le pointage est actuellement clôturé
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              L’enregistrement des présences pour <strong>{session.title}</strong> a été suspendu par le comité d’organisation. Rapprochez-vous du bureau d’accueil de l’ISCAE Manouba si nécessaire.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="pb-4 border-b border-slate-200/80 dark:border-slate-800">
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-50">
                {isEditingReceipt ? 'Corriger mon pointage' : 'Pointer ma présence'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Renseignez votre identité académique exacte pour figurer sur la liste officielle d’émargement.
              </p>
            </div>

            {/* Nom et Prénom */}
            <div>
              <label
                htmlFor="stu-nom"
                className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
              >
                Nom et prénom <span className="text-red-600">*</span>
              </label>
              <input
                id="stu-nom"
                type="text"
                autoComplete="name"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex. Ben Salah Ahmed"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#233886] dark:focus:ring-[#6E8BFF] transition-shadow"
              />
            </div>

            {/* Filière Selection */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Filière &amp; Niveau <span className="text-red-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setUseCustomGrpMode((v) => !v)}
                  className="text-xs font-medium text-[#233886] dark:text-[#7C96FF] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {useCustomGrpMode ? 'Utiliser la sélection guidée' : 'Saisie libre complète'}
                </button>
              </div>

              {!useCustomGrpMode ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ISCAE_FILIERES.map((fil) => {
                      const active = selectedFiliere === fil.label;
                      return (
                        <button
                          key={fil.id}
                          type="button"
                          onClick={() => setSelectedFiliere(fil.label)}
                          title={fil.fullName}
                          className={`h-10 px-3 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap truncate cursor-pointer ${
                            active
                              ? 'bg-[#233886] text-white border-[#233886] dark:bg-[#6E8BFF] dark:text-[#080D21] dark:border-[#6E8BFF]'
                              : 'bg-[#F8F9FC] dark:bg-[#0B0F1E] text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                          }`}
                        >
                          {fil.label}
                        </button>
                      );
                    })}
                  </div>

                  {selectedFiliere === 'Autre' && (
                    <input
                      type="text"
                      value={customFiliere}
                      onChange={(e) => setCustomFiliere(e.target.value)}
                      placeholder="Précisez votre parcours ou établissement…"
                      className="mt-2.5 w-full h-11 px-3.5 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#233886]"
                    />
                  )}

                  {/* Groupe Selection */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="stu-groupe-select"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                      >
                        Groupe de TD
                      </label>
                      <select
                        id="stu-groupe-select"
                        value={selectedGroupe}
                        onChange={(e) => {
                          setSelectedGroupe(e.target.value);
                          setCustomGroupe('');
                        }}
                        className="w-full h-11 px-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#233886]"
                      >
                        {ISCAE_GROUPES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="stu-groupe-custom"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                      >
                        Ou précision groupe (optionnel)
                      </label>
                      <input
                        id="stu-groupe-custom"
                        type="text"
                        value={customGroupe}
                        onChange={(e) => setCustomGroupe(e.target.value)}
                        placeholder="Ex. Groupe 7, Enseignant…"
                        className="w-full h-11 px-3.5 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#233886]"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <input
                  type="text"
                  value={customFiliere}
                  onChange={(e) => setCustomFiliere(e.target.value)}
                  placeholder="Ex. 1LSG, groupe 2"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#233886]"
                />
              )}
            </div>

            {/* Optional Matricule / Student Card */}
            <div>
              <label
                htmlFor="stu-mat"
                className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
              >
                N° Carte Étudiant / Matricule{' '}
                <span className="font-normal text-xs text-slate-500">(facultatif)</span>
              </label>
              <input
                id="stu-mat"
                type="text"
                inputMode="numeric"
                value={matricule}
                onChange={(e) => setMatricule(e.target.value)}
                placeholder="Ex. 2401842"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 font-mono text-sm text-slate-900 dark:text-slate-100 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#233886]"
              />
            </div>

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 text-sm text-red-700 dark:text-red-400 pt-1"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 min-w-[200px] h-12 px-6 rounded-xl bg-[#233886] hover:bg-[#1B2C6B] dark:bg-[#6E8BFF] dark:hover:bg-[#869EFF] text-white dark:text-[#080D21] font-semibold text-sm transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                {submitting
                  ? 'Enregistrement en cours…'
                  : isEditingReceipt
                  ? 'Enregistrer les modifications'
                  : 'Je confirme ma présence'}
              </button>

              {isEditingReceipt && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingReceipt(false);
                    setFormError(null);
                  }}
                  className="h-12 px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        )}

        {/* Discreet Admin Gate when accessed via Student Link */}
        {isStudentOnlyLink && !isOrganizerUnlocked && (
          <div className="mt-8 pt-5 border-t border-slate-200/80 dark:border-slate-800 no-print">
            {!showAdminGate ? (
              <button
                type="button"
                onClick={() => setShowAdminGate(true)}
                className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Accès administrateur / comité d’organisation</span>
              </button>
            ) : (
              <form onSubmit={handleAdminUnlock} className="space-y-3 max-w-sm">
                <label
                  htmlFor="adm-code"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Code d’accès organisateur
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="adm-code"
                    type="password"
                    autoComplete="off"
                    value={adminCodeInput}
                    onChange={(e) => setAdminCodeInput(e.target.value)}
                    placeholder="Saisir le code secret…"
                    className="flex-1 h-10 px-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm"
                  />
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-xl bg-[#233886] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Valider
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminGate(false);
                      setAdminError(null);
                    }}
                    className="h-10 px-3 rounded-xl text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
                {adminError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{adminError}</p>
                )}
              </form>
            )}
          </div>
        )}
      </div>

      {/* Right Column: Institutional Instructions & Direct QR Access */}
      <aside className="lg:col-span-5 bg-white dark:bg-[#13192E] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between no-print">
        <div>
          <h3 className="text-lg font-display font-bold text-slate-900 dark:text-slate-50">
            Accès rapide par QR Code
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            Faites scanner ce code par vos collègues dans l’amphithéâtre pour accéder directement au formulaire mobile.
          </p>

          <div className="my-6 flex flex-col items-center">
            <QrCodeCanvas value={studentCheckInUrl} size={172} />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-mono tabular-nums">
              {myReceipt ? `Reçu vérifié · ${formatTimePrecise(myReceipt.ts)}` : 'Scan direct · Sans création de compte'}
            </p>
          </div>
        </div>

        <div className="pt-5 border-t border-slate-200/80 dark:border-slate-800 space-y-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-slate-800 dark:text-slate-200">Règle d’intégrité</span>
            <span>1 pointage unique par appareil</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-slate-800 dark:text-slate-200">Délai de correction</span>
            <span className="font-mono tabular-nums">10 minutes après validation</span>
          </div>
          {isOrganizerUnlocked && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenAmphitheater}
                className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#233886] dark:text-[#7C96FF] hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors whitespace-nowrap cursor-pointer"
              >
                Afficher en plein écran pour vidéoprojecteur
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
