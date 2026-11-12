import React, { useState } from 'react';
import { Building2, GraduationCap } from 'lucide-react';
import { LOGO_ISCAE, LOGO_UMA } from '../assets/logos';
import type { EventSessionConfig } from '../types';

interface InstitutionalCrestProps {
  session: EventSessionConfig;
  totalPresent: number;
  compact?: boolean;
}

export const InstitutionalCrest: React.FC<InstitutionalCrestProps> = ({
  session,
  totalPresent,
  compact = false,
}) => {
  const [umaFailed, setUmaFailed] = useState(false);
  const [iscaeFailed, setIscaeFailed] = useState(false);

  return (
    <section className="bg-white dark:bg-[#13192E] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden">
      {/* Official Institutional Crest Plate (white archival surface preserves dark-ink academic seals in both themes) */}
      <div className="bg-white px-5 py-3.5 sm:px-7 sm:py-4 border-b-[3px] border-[#C8A53A] flex items-center justify-between gap-6">
        <div className="flex items-center min-w-0">
          {!umaFailed ? (
            <img
              src={LOGO_UMA}
              alt="Université de la Manouba"
              referrerPolicy="no-referrer"
              onError={() => setUmaFailed(true)}
              className={`${compact ? 'h-10 sm:h-11' : 'h-12 sm:h-14'} w-auto object-contain`}
            />
          ) : (
            <div className="flex items-center gap-2 text-[#233886] font-display font-semibold text-sm">
              <Building2 className="w-5 h-5 shrink-0" />
              <span>Université de la Manouba</span>
            </div>
          )}
        </div>

        <div className="hidden md:block text-center px-4">
          <p className="text-[11px] tracking-widest uppercase text-slate-500 font-medium">
            République Tunisienne · Ministère de l’Enseignement Supérieur
          </p>
          <p className="text-xs text-slate-700 font-medium mt-0.5">
            Campus Universitaire de la Manouba
          </p>
        </div>

        <div className="flex items-center justify-end min-w-0">
          {!iscaeFailed ? (
            <img
              src={LOGO_ISCAE}
              alt="ISCAE – Institut Supérieur de Comptabilité et d’Administration des Entreprises"
              referrerPolicy="no-referrer"
              onError={() => setIscaeFailed(true)}
              className={`${compact ? 'h-10 sm:h-11' : 'h-12 sm:h-14'} w-auto object-contain`}
            />
          ) : (
            <div className="flex items-center gap-2 text-[#233886] font-display font-semibold text-sm">
              <GraduationCap className="w-5 h-5 shrink-0" />
              <span>ISCAE Manouba</span>
            </div>
          )}
        </div>
      </div>

      {/* Institutional Event Header & Operational Strip */}
      {!compact && (
        <div className="px-5 py-5 sm:px-7 sm:py-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              <span>{session.institution}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{session.dateLabel}</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-50"
              style={{ textWrap: 'balance' }}
            >
              {session.title}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {session.location}
            </p>
          </div>

          {/* Unboxed clean operational telemetry */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-200/80 dark:border-slate-800">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-semibold tabular-nums text-[#233886] dark:text-[#7C96FF]">
                {totalPresent}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                présent{totalPresent > 1 ? 's' : ''} enregistré{totalPresent > 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              /
            </span>
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {session.isOpen ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  Session ouverte au pointage
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">
                  Session clôturée
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
