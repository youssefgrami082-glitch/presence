import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PresenceRecord {
  id: string;
  code: string;
  nom: string;
  filiere: string;
  groupe: string;
  grp: string;
  matricule?: string;
  ts: number;
  source: 'etudiant' | 'organisateur';
  deviceId: string;
}

interface EventSessionConfig {
  title: string;
  subtitle: string;
  institution: string;
  location: string;
  dateLabel: string;
  recipientEmail: string;
  isOpen: boolean;
  capacity: number;
}

interface PersistedData {
  session: EventSessionConfig;
  presences: PresenceRecord[];
}

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'iscae-pointage.json');

function createReceiptCode(existingCodes: Set<string>): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let attempt = 0; attempt < 50; attempt++) {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars[crypto.randomInt(0, chars.length)];
    }
    const candidate = `ISC-${suffix}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `ISC-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function buildInitialSeed(): PersistedData {
  const now = Date.now();
  const min = 60 * 1000;
  const seedEntries: Array<{
    nom: string;
    filiere: string;
    groupe: string;
    matricule: string;
    offsetMin: number;
    code: string;
  }> = [
    {
      nom: 'Ben Salah Ahmed',
      filiere: '1LSG',
      groupe: 'Groupe 2',
      matricule: '2401842',
      offsetMin: 46,
      code: 'ISC-482M',
    },
    {
      nom: 'Ben Romdhane Yasmine',
      filiere: 'Master MKT',
      groupe: 'Groupe 1',
      matricule: '2100493',
      offsetMin: 41,
      code: 'ISC-93KP',
    },
    {
      nom: 'Trabelsi Ines',
      filiere: '3LSG · MKT',
      groupe: 'Groupe 1',
      matricule: '2201158',
      offsetMin: 35,
      code: 'ISC-72QN',
    },
    {
      nom: 'Gharbi Mehdi',
      filiere: '2LSG',
      groupe: 'Groupe 3',
      matricule: '2300914',
      offsetMin: 28,
      code: 'ISC-56TR',
    },
    {
      nom: 'Bouazizi Nourhene',
      filiere: 'Master MNG',
      groupe: 'Groupe 1',
      matricule: '2100772',
      offsetMin: 22,
      code: 'ISC-84VW',
    },
    {
      nom: 'Khelifi Youssef',
      filiere: 'LSC',
      groupe: 'Groupe 2',
      matricule: '2301520',
      offsetMin: 16,
      code: 'ISC-39CX',
    },
    {
      nom: 'Mansouri Salma',
      filiere: '3LSG · MNG',
      groupe: 'Groupe 2',
      matricule: '2200631',
      offsetMin: 9,
      code: 'ISC-61HJ',
    },
    {
      nom: 'Jebali Aziz',
      filiere: '1LSG',
      groupe: 'Groupe 1',
      matricule: '2402109',
      offsetMin: 4,
      code: 'ISC-27DF',
    },
  ];

  const presences: PresenceRecord[] = seedEntries.map((item, idx) => ({
    id: `seed-${idx + 1}`,
    code: item.code,
    nom: item.nom,
    filiere: item.filiere,
    groupe: item.groupe,
    grp: `${item.filiere}, ${item.groupe}`,
    matricule: item.matricule,
    ts: now - item.offsetMin * min,
    source: 'etudiant',
    deviceId: `seed-device-${idx + 1}`,
  }));

  return {
    session: {
      title: 'Management & Marketing',
      subtitle: 'Journée Académique & Rencontres Professionnelles',
      institution: 'ISCAE · Université de la Manouba',
      location: 'Amphithéâtre Central · Campus Universitaire de la Manouba',
      dateLabel: new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      recipientEmail: 'gharbimolka1107@gmail.com',
      isOpen: true,
      capacity: 160,
    },
    presences: presences.sort((a, b) => b.ts - a.ts),
  };
}

function loadStore(): PersistedData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw) as PersistedData;
      if (parsed && parsed.session && Array.isArray(parsed.presences)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read persisted attendance store, initializing fresh:', err);
  }
  const initial = buildInitialSeed();
  saveStore(initial);
  return initial;
}

function saveStore(data: PersistedData): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpFile, DATA_FILE);
  } catch (err) {
    console.error('Failed to persist attendance store:', err);
  }
}

function normalizeText(input: unknown, maxLen = 120): string {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  const store = loadStore();
  const httpServer = createHttpServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  function getConnectedCount(): number {
    let count = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) count++;
    });
    return count;
  }

  function broadcast(message: unknown): void {
    const encoded = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(encoded);
      }
    });
  }

  wss.on('connection', (ws) => {
    const connectedClients = getConnectedCount();
    ws.send(
      JSON.stringify({
        type: 'init',
        payload: {
          session: store.session,
          presences: store.presences,
          connectedClients,
        },
      })
    );
    broadcast({ type: 'clients:count', count: connectedClients });

    ws.on('close', () => {
      broadcast({ type: 'clients:count', count: getConnectedCount() });
    });
  });

  // GET full current state
  app.get('/api/state', (_req: Request, res: Response) => {
    res.json({
      session: store.session,
      presences: store.presences,
      connectedClients: getConnectedCount(),
    });
  });

  // Verify a student receipt code
  app.get('/api/verify/:code', (req: Request, res: Response) => {
    const rawCode = normalizeText(req.params.code, 32).toUpperCase();
    const match = store.presences.find(
      (p) => p.code.toUpperCase() === rawCode || p.code.replace('-', '').toUpperCase() === rawCode.replace('-', '')
    );
    if (!match) {
      res.status(404).json({ found: false, message: 'Aucun pointage trouvé pour ce code de vérification.' });
      return;
    }
    res.json({ found: true, record: match, session: store.session });
  });

  // Create a check-in record (idempotent per deviceId for student check-ins)
  app.post('/api/presences', (req: Request, res: Response) => {
    const nom = normalizeText(req.body?.nom, 90);
    const filiere = normalizeText(req.body?.filiere, 45);
    const groupe = normalizeText(req.body?.groupe, 45);
    const customGrp = normalizeText(req.body?.grp, 90);
    const matricule = normalizeText(req.body?.matricule, 30);
    const source: 'etudiant' | 'organisateur' =
      req.body?.source === 'organisateur' ? 'organisateur' : 'etudiant';
    const deviceId = normalizeText(req.body?.deviceId, 80) || crypto.randomUUID();

    if (source === 'etudiant' && !store.session.isOpen) {
      res.status(403).json({
        error: 'Le pointage des présences est actuellement clôturé par l’organisateur.',
      });
      return;
    }

    if (nom.length < 3) {
      res.status(400).json({ error: 'Veuillez renseigner votre nom et prénom complets (au moins 3 caractères).' });
      return;
    }

    const effectiveGrp =
      customGrp || [filiere, groupe].filter(Boolean).join(', ');
    if (!effectiveGrp) {
      res.status(400).json({ error: 'Veuillez sélectionner ou saisir votre filière et groupe.' });
      return;
    }

    // Idempotency check: if same student device already checked in, return existing record
    if (source === 'etudiant') {
      const existingByDevice = store.presences.find(
        (p) => p.source === 'etudiant' && p.deviceId === deviceId
      );
      if (existingByDevice) {
        res.status(200).json({ record: existingByDevice, alreadyRegistered: true });
        return;
      }

      // Guard against accidental identical Name + Group duplicate from another browser tab
      const normName = nom.toLowerCase();
      const normGrp = effectiveGrp.toLowerCase();
      const duplicatePerson = store.presences.find(
        (p) => p.nom.toLowerCase() === normName && p.grp.toLowerCase() === normGrp
      );
      if (duplicatePerson) {
        res.status(200).json({ record: duplicatePerson, alreadyRegistered: true });
        return;
      }
    }

    const existingCodes = new Set(store.presences.map((p) => p.code));
    const record: PresenceRecord = {
      id: crypto.randomUUID(),
      code: createReceiptCode(existingCodes),
      nom,
      filiere: filiere || effectiveGrp,
      groupe: groupe || '',
      grp: effectiveGrp,
      matricule: matricule || undefined,
      ts: Date.now(),
      source,
      deviceId: source === 'organisateur' ? `org-${crypto.randomUUID()}` : deviceId,
    };

    store.presences.unshift(record);
    store.presences.sort((a, b) => b.ts - a.ts);
    saveStore(store);

    broadcast({ type: 'presence:created', record });
    res.status(201).json({ record, alreadyRegistered: false });
  });

  // Update an existing presence record (organizer or student fixing a typo on their own device within 10 mins)
  app.put('/api/presences/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const index = store.presences.findIndex((p) => p.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Présence introuvable.' });
      return;
    }

    const current = store.presences[index];
    const isOrganizer = req.body?.isOrganizer === true;
    const deviceId = normalizeText(req.body?.deviceId, 80);

    if (!isOrganizer) {
      const withinGraceWindow = Date.now() - current.ts <= 10 * 60 * 1000;
      if (current.deviceId !== deviceId || !withinGraceWindow) {
        res.status(403).json({ error: 'Modification non autorisée après expiration du délai.' });
        return;
      }
    }

    const nom = normalizeText(req.body?.nom, 90) || current.nom;
    const filiere = normalizeText(req.body?.filiere, 45);
    const groupe = normalizeText(req.body?.groupe, 45);
    const customGrp = normalizeText(req.body?.grp, 90);
    const matricule =
      req.body?.matricule !== undefined
        ? normalizeText(req.body?.matricule, 30)
        : current.matricule;

    if (nom.length < 3) {
      res.status(400).json({ error: 'Le nom doit contenir au moins 3 caractères.' });
      return;
    }

    const effectiveGrp =
      customGrp || [filiere, groupe].filter(Boolean).join(', ') || current.grp;

    const updated: PresenceRecord = {
      ...current,
      nom,
      filiere: filiere || current.filiere,
      groupe: groupe !== undefined ? groupe : current.groupe,
      grp: effectiveGrp,
      matricule: matricule || undefined,
    };

    store.presences[index] = updated;
    saveStore(store);
    broadcast({ type: 'presence:updated', record: updated });
    res.json({ record: updated });
  });

  // Delete a presence record
  app.delete('/api/presences/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const before = store.presences.length;
    store.presences = store.presences.filter((p) => p.id !== id);
    if (store.presences.length !== before) {
      saveStore(store);
      broadcast({ type: 'presence:deleted', id });
    }
    res.json({ ok: true });
  });

  // Clear all records (to start a blank event session)
  app.post('/api/presences/clear', (_req: Request, res: Response) => {
    store.presences = [];
    saveStore(store);
    broadcast({ type: 'presence:cleared', presences: [] });
    res.json({ ok: true, presences: [] });
  });

  // Update event session configuration
  app.patch('/api/session', (req: Request, res: Response) => {
    const patch = req.body || {};
    if (typeof patch.title === 'string' && patch.title.trim()) {
      store.session.title = normalizeText(patch.title, 100);
    }
    if (typeof patch.subtitle === 'string') {
      store.session.subtitle = normalizeText(patch.subtitle, 120);
    }
    if (typeof patch.location === 'string' && patch.location.trim()) {
      store.session.location = normalizeText(patch.location, 120);
    }
    if (typeof patch.dateLabel === 'string' && patch.dateLabel.trim()) {
      store.session.dateLabel = normalizeText(patch.dateLabel, 80);
    }
    if (typeof patch.recipientEmail === 'string' && patch.recipientEmail.trim()) {
      store.session.recipientEmail = normalizeText(patch.recipientEmail, 100);
    }
    if (typeof patch.isOpen === 'boolean') {
      store.session.isOpen = patch.isOpen;
    }
    if (typeof patch.capacity === 'number' && patch.capacity >= 1 && patch.capacity <= 5000) {
      store.session.capacity = Math.round(patch.capacity);
    }

    saveStore(store);
    broadcast({ type: 'session:updated', session: store.session });
    res.json({ session: store.session });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ISCAE Manouba Attendance Portal running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
