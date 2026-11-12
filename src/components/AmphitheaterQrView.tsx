import React, { useMemo, useState } from 'react';
import { Check, Copy, Lock, Unlock, Users } from 'lucide-react';
import type { EventSessionConfig, PresenceRecord } from '../types';
import { formatTimeShort } from '../utils/helpers';
import { QrCodeCanvas } from './QrCodeCanvas';

interface AmphitheaterQrViewProps {
  session: EventSessionConfig;
  presences: PresenceRecord[];
  onToggleOpen: (isOpen: boolean) => Promise<boolean>;
}

export const AmphitheaterQrView: React.FC<AmphitheaterQrViewProps> = ({
  session,
  presences,
  onToggleOpen,
}) => {
  const [copied, setCopied] = useState(false);

  const studentUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}?view=pointage`;
  }, []);

  const recentArrivals = useMemo(() => presences.slice(0, 5), [presences]);
  const occupancyPct = Math.min(
    100,
    Math.round((presences.length / Math.max(1, session.capacity)) * 100)
  );

  function copyLink() {
    navigator.clipboard?.writeText(studentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white dark:bg-[#13192E] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left: Giant Scannable Amphitheater QR */}
        <div className="lg:col-span-5 flex flex-col items-center text-center">
          <QrCodeCanvas value={studentUrl} size={280} />
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Lien étudiant copié</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copier le lien étudiant</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onToggleOpen(!session.isOpen)}
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                session.isOpen
                  ? 'border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                  : 'bg-emerald-700 text-white hover:bg-emerald-800'
              }`}
            >
              {session.isOpen ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Clôturer le pointage</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Rouvrir le pointage</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Projection Instructions & Live Counter */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">
              Projection Amphithéâtre · {session.institution}
            </p>
            <h2
              className="text-3xl sm:text-4xl font-display font-bold text-slate-900 dark:text-slate-50 mt-2"
              style={{ textWrap: 'balance' }}
            >
              Scannez le QR Code pour enregistrer votre présence
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-300 mt-2">
              1. Ouvrez l’appareil photo de votre téléphone · 2. Renseignez votre nom, prénom et groupe · 3. Conservez votre code de confirmation.
            </p>
          </div>

          {/* Live Counter Strip */}
          <div className="py-5 border-y border-slate-200/80 dark:border-slate-800 flex flex-wrap items-baseline justify-between gap-6">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl sm:text-6xl font-mono font-bold tabular-nums text-[#233886] dark:text-[#7C96FF]">
                  {presences.length}
                </span>
                <span className="text-lg font-medium text-slate-600 dark:text-slate-400">
                  / <span className="font-mono tabular-nums">{session.capacity}</span> présent(s)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Taux de remplissage estimé :{' '}
                <span className="font-mono font-semibold tabular-nums">{occupancyPct}%</span>
              </p>
            </div>

            <div className="w-full sm:w-56">
              <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#233886] dark:bg-[#6E8BFF] transition-transform duration-200 origin-left"
                  style={{ transform: `scaleX(${occupancyPct / 100})` }}
                />
              </div>
              <p className="text-xs text-right text-slate-500 dark:text-slate-400 mt-1.5">
                {session.isOpen ? 'Enregistrement en direct actif' : 'Pointage suspendu'}
              </p>
            </div>
          </div>

          {/* Recent Live Check-Ins */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
              <Users className="w-4 h-4" />
              <span>Derniers pointages validés en direct</span>
            </div>
            {recentArrivals.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                En attente du premier pointage étudiant…
              </p>
            ) : (
              <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/80 text-sm">
                {recentArrivals.map((item) => (
                  <li key={item.id} className="py-2.5 flex items-center justify-between gap-4">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {item.nom}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                      <span>{item.grp}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatTimeShort(item.ts)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
