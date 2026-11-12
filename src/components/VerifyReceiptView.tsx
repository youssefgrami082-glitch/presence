import React, { useState } from 'react';
import { CheckCircle2, Search, XCircle } from 'lucide-react';
import type { PresenceRecord } from '../types';
import { formatDateTimeFull } from '../utils/helpers';

interface VerifyReceiptViewProps {
  presences: PresenceRecord[];
}

export const VerifyReceiptView: React.FC<VerifyReceiptViewProps> = ({ presences }) => {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const trimmed = submittedQuery.trim().toLowerCase();

  const matches = trimmed
    ? presences.filter(
        (p) =>
          p.code.toLowerCase() === trimmed ||
          p.code.replace('-', '').toLowerCase() === trimmed.replace('-', '') ||
          p.nom.toLowerCase().includes(trimmed) ||
          (p.matricule && p.matricule.toLowerCase() === trimmed)
      )
    : [];

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedQuery(query);
  }

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-[#13192E] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
      <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-50">
        Vérification d’un justificatif de présence
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Saisissez un code de récépissé (ex. <span className="font-mono">ISC-482M</span>), un numéro de carte étudiant ou un nom complet pour contrôler instantanément son authenticité.
      </p>

      <form onSubmit={handleSearch} className="mt-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSubmittedQuery(e.target.value);
            }}
            placeholder="Code ISC-XXXX, matricule ou nom de l’étudiant…"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F9FC] dark:bg-[#0B0F1E] border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#233886]"
          />
        </div>
        <button
          type="submit"
          className="h-11 px-6 rounded-xl bg-[#233886] hover:bg-[#1B2C6B] dark:bg-[#6E8BFF] dark:text-[#080D21] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Vérifier
        </button>
      </form>

      {trimmed && (
        <div className="mt-6 pt-6 border-t border-slate-200/80 dark:border-slate-800">
          {matches.length === 0 ? (
            <div className="flex items-start gap-3 text-red-700 dark:text-red-400">
              <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Aucun enregistrement correspondant</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Vérifiez l’orthographe du code ou assurez-vous que le pointage a bien été soumis.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono font-semibold tabular-nums">{matches.length}</span>{' '}
                résultat{matches.length > 1 ? 's' : ''} authentifié{matches.length > 1 ? 's' : ''}
              </p>
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {matches.map((record) => (
                  <div
                    key={record.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {record.nom}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>{record.grp}</span>
                          {record.matricule && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">Mat. {record.matricule}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="sm:text-right pl-7 sm:pl-0">
                      <p className="font-mono font-semibold text-sm tabular-nums text-[#233886] dark:text-[#7C96FF]">
                        {record.code}
                      </p>
                      <p className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {formatDateTimeFull(record.ts)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
