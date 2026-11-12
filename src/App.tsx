import React, { useEffect, useMemo, useState } from 'react';
import { Moon, Sun, X } from 'lucide-react';
import { useAttendanceStore } from './hooks/useAttendanceStore';
import { InstitutionalCrest } from './components/InstitutionalCrest';
import { StudentCheckInView } from './components/StudentCheckInView';
import { OrganizerDashboardView } from './components/OrganizerDashboardView';
import { AmphitheaterQrView } from './components/AmphitheaterQrView';
import { VerifyReceiptView } from './components/VerifyReceiptView';
import {
  applyTheme,
  getInitialTheme,
  getSavedAdminUnlocked,
  setSavedAdminUnlocked,
  triggerCsvDownload,
  verifyAdminCode,
} from './utils/helpers';

type ActiveTab = 'pointage' | 'organisateur' | 'amphitheatre' | 'verification';

export function App() {
  const isStudentOnlyLink = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'pointage';
  }, []);

  const [isOrganizerUnlocked, setIsOrganizerUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const params = new URLSearchParams(window.location.search);
    // Direct QR scans (?view=pointage) lock organizer tabs behind the SHA-256 admin code;
    // Root organizer preview unlocks directly (matching owner=user.isOwner() in original portal)
    if (params.get('view') === 'pointage') {
      return getSavedAdminUnlocked();
    }
    return true;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    isStudentOnlyLink ? 'pointage' : 'pointage'
  );

  const [theme, setTheme] = useState<'light' | 'dark'>(() => getInitialTheme());
  const [fontStyle, setFontStyle] = useState<'academic' | 'modern' | 'cormorant'>(() => {
    try {
      const saved = localStorage.getItem('iscae_font_style');
      if (saved === 'modern' || saved === 'cormorant' || saved === 'academic') return saved;
    } catch {
      // ignore
    }
    return 'academic';
  });
  const [pendingProtectedTab, setPendingProtectedTab] = useState<ActiveTab | null>(null);
  const [adminModalCode, setAdminModalCode] = useState('');
  const [adminModalError, setAdminModalError] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-font', fontStyle);
      try {
        localStorage.setItem('iscae_font_style', fontStyle);
      } catch {
        // ignore
      }
    }
  }, [fontStyle]);

  const {
    session,
    presences,
    loading,
    wsConnected,
    connectedClients,
    myReceipt,
    errorBanner,
    submitCheckIn,
    updatePresence,
    deletePresence,
    clearAllPresences,
    updateSession,
    resetDeviceSession,
  } = useAttendanceStore();

  function navigateTab(target: ActiveTab) {
    if (
      (target === 'organisateur' || target === 'amphitheatre') &&
      !isOrganizerUnlocked
    ) {
      setPendingProtectedTab(target);
      setAdminModalCode('');
      setAdminModalError(null);
      return;
    }
    setActiveTab(target);
  }

  async function handleAdminModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await verifyAdminCode(adminModalCode);
    if (!ok) {
      setAdminModalError('Code d’accès administrateur incorrect.');
      return;
    }
    setIsOrganizerUnlocked(true);
    setSavedAdminUnlocked(true);
    if (pendingProtectedTab) {
      setActiveTab(pendingProtectedTab);
    }
    setPendingProtectedTab(null);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FC] dark:bg-[#0B0F1E] text-slate-900 dark:text-slate-100">
      {/* Strict 3-Zone Single-Row Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#13192E]/95 backdrop-blur-sm border-b border-slate-200/90 dark:border-slate-800 no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigateTab('pointage')}
            className="text-base sm:text-lg font-display font-bold tracking-tight text-[#233886] dark:text-[#8FA6FF] whitespace-nowrap shrink-0 cursor-pointer"
          >
            ISCAE Manouba
          </button>

          {/* Zone 2: Clean Single-Line Text Navigation Links */}
          <nav
            aria-label="Navigation principale"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <button
              type="button"
              onClick={() => navigateTab('pointage')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'pointage'
                  ? 'border-[#233886] dark:border-[#8FA6FF] text-slate-950 dark:text-white font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Pointage
            </button>
            <button
              type="button"
              onClick={() => navigateTab('organisateur')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'organisateur'
                  ? 'border-[#233886] dark:border-[#8FA6FF] text-slate-950 dark:text-white font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tableau de bord
            </button>
            <button
              type="button"
              onClick={() => navigateTab('amphitheatre')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'amphitheatre'
                  ? 'border-[#233886] dark:border-[#8FA6FF] text-slate-950 dark:text-white font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Amphithéâtre QR
            </button>
            <button
              type="button"
              onClick={() => navigateTab('verification')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'verification'
                  ? 'border-[#233886] dark:border-[#8FA6FF] text-slate-950 dark:text-white font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Vérification
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            {activeTab === 'organisateur' && isOrganizerUnlocked ? (
              <button
                type="button"
                onClick={() => triggerCsvDownload(presences)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#233886] hover:bg-[#1B2C6B] dark:bg-[#6E8BFF] dark:text-[#080D21] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Exporter CSV
              </button>
            ) : activeTab !== 'pointage' ? (
              <button
                type="button"
                onClick={() => navigateTab('pointage')}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#233886] hover:bg-[#1B2C6B] dark:bg-[#6E8BFF] dark:text-[#080D21] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Pointer ma présence
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigateTab('organisateur')}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#233886] hover:bg-[#1B2C6B] dark:bg-[#6E8BFF] dark:text-[#080D21] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Espace organisateur
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Segmented Navigation Bar (Visible on narrow screens < md) */}
      <div className="md:hidden px-4 pt-3 no-print">
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/70 dark:bg-[#13192E] rounded-xl border border-slate-200/80 dark:border-slate-800">
          {(
            [
              { id: 'pointage', label: 'Pointage' },
              { id: 'organisateur', label: 'Console' },
              { id: 'amphitheatre', label: 'Code QR' },
              { id: 'verification', label: 'Vérifier' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTab(item.id)}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap truncate cursor-pointer ${
                activeTab === item.id
                  ? 'bg-white dark:bg-[#1E2849] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="no-print">
          <InstitutionalCrest
            session={session}
            totalPresent={presences.length}
            compact={activeTab === 'amphitheatre'}
          />
        </div>

        {errorBanner && (
          <div
            role="alert"
            className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl px-4 py-3 text-xs text-red-800 dark:text-red-300 no-print"
          >
            {errorBanner}
          </div>
        )}

        {activeTab === 'pointage' && (
          <StudentCheckInView
            session={session}
            myReceipt={myReceipt}
            isStudentOnlyLink={isStudentOnlyLink}
            isOrganizerUnlocked={isOrganizerUnlocked}
            onCheckIn={submitCheckIn}
            onUpdateOwnReceipt={(id, data) => updatePresence(id, { ...data, isOrganizer: false })}
            onAdminUnlocked={() => {
              setIsOrganizerUnlocked(true);
              setSavedAdminUnlocked(true);
              setActiveTab('organisateur');
            }}
            onSimulateNewDevice={resetDeviceSession}
            onOpenAmphitheater={() => navigateTab('amphitheatre')}
          />
        )}

        {activeTab === 'organisateur' && (
          <OrganizerDashboardView
            session={session}
            presences={presences}
            loading={loading}
            wsConnected={wsConnected}
            connectedClients={connectedClients}
            onManualAdd={submitCheckIn}
            onUpdateRecord={updatePresence}
            onDeleteRecord={deletePresence}
            onClearAll={clearAllPresences}
            onUpdateSession={updateSession}
          />
        )}

        {activeTab === 'amphitheatre' && (
          <AmphitheaterQrView
            session={session}
            presences={presences}
            onToggleOpen={(isOpen) => updateSession({ isOpen })}
          />
        )}

        {activeTab === 'verification' && <VerifyReceiptView presences={presences} />}
      </main>

      {/* Clean Institutional Footer + Theme Switch */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 py-5 px-4 sm:px-6 mt-8 no-print">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span>ISCAE Manouba</span>
            <span aria-hidden="true">·</span>
            <span>Université de la Manouba</span>
            <span aria-hidden="true">·</span>
            <span>Portail d’émargement Management &amp; Marketing</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFontStyle((prev) =>
                  prev === 'academic' ? 'modern' : prev === 'modern' ? 'cormorant' : 'academic'
                );
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13192E] text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Changer le style d'écriture du site"
            >
              <span className="font-semibold text-[11px] font-mono">Aa</span>
              <span>
                {fontStyle === 'academic'
                  ? 'Police : Éditoriale'
                  : fontStyle === 'modern'
                  ? 'Police : Moderne'
                  : 'Police : Garamond'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#13192E] text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#D8B84E]" />
                  <span>Thème clair</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#233886]" />
                  <span>Thème sombre</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* Protected Admin Code Modal (when accessing from ?view=pointage student QR link) */}
      {pendingProtectedTab && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-[#13192E] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-50">
                Accès réservé à l’organisateur
              </h3>
              <button
                type="button"
                onClick={() => setPendingProtectedTab(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdminModalSubmit} className="mt-4 space-y-3">
              <label
                htmlFor="modal-adm-code"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Veuillez saisir le code d’accès administrateur
              </label>
              <input
                id="modal-adm-code"
                type="password"
                autoFocus
                autoComplete="off"
                value={adminModalCode}
                onChange={(e) => setAdminModalCode(e.target.value)}
                placeholder="Code secret…"
                className="w-full h-10 px-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm"
              />
              {adminModalError && (
                <p className="text-xs text-red-600 dark:text-red-400">{adminModalError}</p>
              )}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingProtectedTab(null)}
                  className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-xl bg-[#233886] text-white text-xs font-semibold cursor-pointer"
                >
                  Déverrouiller
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
