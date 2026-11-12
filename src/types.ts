export type PresenceSource = 'etudiant' | 'organisateur';

export interface PresenceRecord {
  id: string;
  code: string;
  nom: string;
  filiere: string;
  groupe: string;
  grp: string;
  matricule?: string;
  ts: number;
  source: PresenceSource;
  deviceId: string;
}

export interface EventSessionConfig {
  title: string;
  subtitle: string;
  institution: string;
  location: string;
  dateLabel: string;
  recipientEmail: string;
  isOpen: boolean;
  capacity: number;
}

export interface ServerStatePayload {
  session: EventSessionConfig;
  presences: PresenceRecord[];
  connectedClients: number;
}

export type WsServerMessage =
  | { type: 'init'; payload: ServerStatePayload }
  | { type: 'presence:created'; record: PresenceRecord }
  | { type: 'presence:updated'; record: PresenceRecord }
  | { type: 'presence:deleted'; id: string }
  | { type: 'presence:cleared'; presences: PresenceRecord[] }
  | { type: 'session:updated'; session: EventSessionConfig }
  | { type: 'clients:count'; count: number };

export const ISCAE_FILIERES = [
  { id: '1LSG', label: '1LSG', fullName: '1ère Licence Sciences de Gestion' },
  { id: '2LSG', label: '2LSG', fullName: '2ème Licence Sciences de Gestion' },
  { id: '3LSG-MKT', label: '3LSG · MKT', fullName: '3ème Licence Marketing' },
  { id: '3LSG-MNG', label: '3LSG · MNG', fullName: '3ème Licence Management' },
  { id: 'LSC', label: 'LSC', fullName: 'Licence Sciences Comptables (1/2/3)' },
  { id: 'LBI', label: 'LBI', fullName: 'Licence Business Computing' },
  { id: 'Master-MKT', label: 'Master MKT', fullName: 'Master Marketing' },
  { id: 'Master-MNG', label: 'Master MNG', fullName: 'Master Management' },
  { id: 'Autre', label: 'Autre', fullName: 'Autre filière / Invité' },
] as const;

export const ISCAE_GROUPES = [
  'Groupe 1',
  'Groupe 2',
  'Groupe 3',
  'Groupe 4',
  'Groupe 5',
  'Groupe 6',
  'TD Unique',
] as const;

// Original SHA-256 administrator code hash preserved from the ISCAE Manouba HTML portal
export const ORIGINAL_ADMIN_SHA256 =
  '86a34765fe21e3a25d6f1ad93c84114d3b8ad9548eb979782fd820cf764b2522';
