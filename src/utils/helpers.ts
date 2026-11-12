import type { EventSessionConfig, PresenceRecord } from '../types';
import { ORIGINAL_ADMIN_SHA256 } from '../types';

const DEVICE_ID_KEY = 'iscae_rh_device_uid_v2';
const RECEIPT_CACHE_KEY = 'iscae_rh_pointage_v2';
const LEGACY_DEVICE_KEY = 'iscae_rh_pointage_v1';
const ADMIN_AUTH_KEY = 'iscae_rh_admin_unlocked_v2';
const THEME_KEY = 'iscae_rh_theme_v2';

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const generated =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `mem-${Date.now()}`;
  }
}

export function resetLocalDeviceForTesting(): string {
  try {
    const fresh =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, fresh);
    localStorage.removeItem(RECEIPT_CACHE_KEY);
    localStorage.removeItem(LEGACY_DEVICE_KEY);
    return fresh;
  } catch {
    return `mem-${Date.now()}`;
  }
}

export function getSavedReceipt(): PresenceRecord | null {
  try {
    const raw = localStorage.getItem(RECEIPT_CACHE_KEY);
    if (raw) {
      return JSON.parse(raw) as PresenceRecord;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export function saveLocalReceipt(record: PresenceRecord): void {
  try {
    localStorage.setItem(RECEIPT_CACHE_KEY, JSON.stringify(record));
  } catch {
    // ignore storage errors
  }
}

export function clearLocalReceipt(): void {
  try {
    localStorage.removeItem(RECEIPT_CACHE_KEY);
  } catch {
    // ignore
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyAdminCode(code: string): Promise<boolean> {
  const trimmed = code.trim();
  if (!trimmed) return false;
  const hash = await sha256Hex(trimmed);
  return hash === ORIGINAL_ADMIN_SHA256;
}

export function getSavedAdminUnlocked(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_AUTH_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSavedAdminUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) {
      sessionStorage.setItem(ADMIN_AUTH_KEY, '1');
    } else {
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
    }
  } catch {
    // ignore
  }
}

export function getInitialTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(theme: 'light' | 'dark'): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function formatTimeShort(ts: number): string {
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimePrecise(ts: number): string {
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateTimeFull(ts: number): string {
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function csvEscapeCell(value: string | number | undefined): string {
  const str = String(value ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

export function generateCsvContent(presences: PresenceRecord[]): string {
  const sorted = [...presences].sort((a, b) => a.ts - b.ts);
  const header = [
    'N°',
    'Code Vérification',
    'Nom et Prénom',
    'Filière',
    'Groupe',
    'Filière / Groupe complet',
    'N° Carte Étudiant',
    'Heure de Pointage',
    'Mode',
  ].join(';');

  const lines = sorted.map((r, index) =>
    [
      csvEscapeCell(index + 1),
      csvEscapeCell(r.code),
      csvEscapeCell(r.nom),
      csvEscapeCell(r.filiere),
      csvEscapeCell(r.groupe),
      csvEscapeCell(r.grp),
      csvEscapeCell(r.matricule || ''),
      csvEscapeCell(formatDateTimeFull(r.ts)),
      csvEscapeCell(r.source === 'organisateur' ? 'Manuel (Organisateur)' : 'QR / Portail Étudiant'),
    ].join(';')
  );

  // UTF-8 BOM ensures Microsoft Excel (French locale) opens accents & semicolon columns cleanly
  return '\uFEFF' + [header, ...lines].join('\r\n');
}

export function triggerCsvDownload(presences: PresenceRecord[], filename = 'presences-iscae-manouba.csv'): void {
  const csv = generateCsvContent(presences);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildEmailSummary(
  presences: PresenceRecord[],
  session: EventSessionConfig
): { subject: string; fullBody: string; mailtoHref: string; isTruncatedInMailto: boolean } {
  const sorted = [...presences].sort((a, b) => a.ts - b.ts);
  const subject = `Présences – ${session.title} (${session.institution})`;
  const header =
    `Liste officielle des présences – ${session.title}\n` +
    `Établissement : ${session.institution}\n` +
    `Lieu : ${session.location}\n` +
    `Date : ${session.dateLabel}\n` +
    `Total enregistré : ${sorted.length} présent(s)\n` +
    `--------------------------------------------------\n\n`;

  const lines = sorted.map(
    (r, i) =>
      `${String(i + 1).padStart(2, '0')}. ${r.nom} (${r.grp})${
        r.matricule ? ` [Mat: ${r.matricule}]` : ''
      } – ${formatTimeShort(r.ts)} [${r.code}]`
  );

  const fullBody = header + (lines.length ? lines.join('\n') : 'Aucune présence enregistrée.');

  // Construct safe mailto URI within RFC/browser URL length budgets (~1850 chars)
  const truncationNote =
    '\n\n[Liste abrégée pour le lien e-mail direct : copiez le texte complet ci-contre ou joignez le fichier CSV exporté.]';
  const mailtoLines = [...lines];
  let isTruncatedInMailto = false;
  let candidateBody = fullBody;

  while (
    encodeURIComponent(candidateBody + (isTruncatedInMailto ? truncationNote : '')).length > 1750 &&
    mailtoLines.length > 0
  ) {
    mailtoLines.pop();
    isTruncatedInMailto = true;
    candidateBody = header + mailtoLines.join('\n');
  }
  if (isTruncatedInMailto) {
    candidateBody += truncationNote;
  }

  const mailtoHref = `mailto:${encodeURIComponent(session.recipientEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(candidateBody)}`;

  return { subject, fullBody, mailtoHref, isTruncatedInMailto };
}
