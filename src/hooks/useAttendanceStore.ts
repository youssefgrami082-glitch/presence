import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EventSessionConfig,
  PresenceRecord,
  PresenceSource,
  ServerStatePayload,
  WsServerMessage,
} from '../types';
import {
  clearLocalReceipt,
  getOrCreateDeviceId,
  getSavedReceipt,
  resetLocalDeviceForTesting,
  saveLocalReceipt,
} from '../utils/helpers';

const DEFAULT_SESSION: EventSessionConfig = {
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
};

export function useAttendanceStore() {
  const [session, setSession] = useState<EventSessionConfig>(DEFAULT_SESSION);
  const [presences, setPresences] = useState<PresenceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [connectedClients, setConnectedClients] = useState<number>(1);
  const [deviceId, setDeviceId] = useState<string>(() => getOrCreateDeviceId());
  const [myReceipt, setMyReceipt] = useState<PresenceRecord | null>(() => getSavedReceipt());
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  // Sync myReceipt with authoritative server list
  const syncMyReceiptFromList = useCallback(
    (list: PresenceRecord[], currentDeviceId: string) => {
      const serverMatch = list.find(
        (item) => item.source === 'etudiant' && item.deviceId === currentDeviceId
      );
      if (serverMatch) {
        setMyReceipt(serverMatch);
        saveLocalReceipt(serverMatch);
      } else {
        // If previously cached receipt was removed by organizer or list reset, unlock device
        const cached = getSavedReceipt();
        if (cached && !list.some((item) => item.id === cached.id)) {
          setMyReceipt(null);
          clearLocalReceipt();
        }
      }
    },
    []
  );

  const fetchState = useCallback(
    async (activeDevId: string) => {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) throw new Error('Erreur réseau');
        const data = (await res.json()) as ServerStatePayload;
        setSession(data.session);
        setPresences(data.presences);
        setConnectedClients(data.connectedClients || 1);
        syncMyReceiptFromList(data.presences, activeDevId);
        setErrorBanner(null);
      } catch {
        setErrorBanner('Impossible de synchroniser les données avec le serveur.');
      } finally {
        setLoading(false);
      }
    },
    [syncMyReceiptFromList]
  );

  useEffect(() => {
    let unmounted = false;

    fetchState(deviceId);

    function connectWebSocket() {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socketUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(socketUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        setWsConnected(true);
        setErrorBanner(null);
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        try {
          const msg = JSON.parse(event.data) as WsServerMessage;
          if (msg.type === 'init') {
            setSession(msg.payload.session);
            setPresences(msg.payload.presences);
            setConnectedClients(msg.payload.connectedClients || 1);
            syncMyReceiptFromList(msg.payload.presences, deviceId);
            setLoading(false);
          } else if (msg.type === 'presence:created') {
            setPresences((prev) => {
              // Idempotent guard against duplicate broadcast/HTTP response
              if (prev.some((p) => p.id === msg.record.id)) return prev;
              const next = [msg.record, ...prev].sort((a, b) => b.ts - a.ts);
              syncMyReceiptFromList(next, deviceId);
              return next;
            });
          } else if (msg.type === 'presence:updated') {
            setPresences((prev) => {
              const next = prev.map((p) => (p.id === msg.record.id ? msg.record : p));
              syncMyReceiptFromList(next, deviceId);
              return next;
            });
          } else if (msg.type === 'presence:deleted') {
            setPresences((prev) => {
              const next = prev.filter((p) => p.id !== msg.id);
              syncMyReceiptFromList(next, deviceId);
              return next;
            });
          } else if (msg.type === 'presence:cleared') {
            setPresences([]);
            setMyReceipt(null);
            clearLocalReceipt();
          } else if (msg.type === 'session:updated') {
            setSession(msg.session);
          } else if (msg.type === 'clients:count') {
            setConnectedClients(msg.count);
          }
        } catch {
          // ignore malformed ws message
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setWsConnected(false);
        reconnectTimerRef.current = window.setTimeout(() => {
          fetchState(deviceId);
          connectWebSocket();
        }, 2500);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connectWebSocket();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [deviceId, fetchState, syncMyReceiptFromList]);

  const submitCheckIn = useCallback(
    async (input: {
      nom: string;
      filiere: string;
      groupe: string;
      grp?: string;
      matricule?: string;
      source?: PresenceSource;
    }): Promise<{ ok: boolean; record?: PresenceRecord; alreadyRegistered?: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/presences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...input,
            deviceId,
            source: input.source || 'etudiant',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data?.error || 'Échec de l’enregistrement.' };
        }
        const record = data.record as PresenceRecord;
        setPresences((prev) => {
          if (prev.some((p) => p.id === record.id)) return prev;
          return [record, ...prev].sort((a, b) => b.ts - a.ts);
        });
        if ((input.source || 'etudiant') === 'etudiant') {
          setMyReceipt(record);
          saveLocalReceipt(record);
        }
        return { ok: true, record, alreadyRegistered: Boolean(data.alreadyRegistered) };
      } catch {
        return { ok: false, error: 'Erreur réseau lors de la confirmation. Veuillez réessayer.' };
      }
    },
    [deviceId]
  );

  const updatePresence = useCallback(
    async (
      id: string,
      patch: {
        nom: string;
        filiere: string;
        groupe: string;
        grp?: string;
        matricule?: string;
        isOrganizer?: boolean;
      }
    ): Promise<{ ok: boolean; record?: PresenceRecord; error?: string }> => {
      try {
        const res = await fetch(`/api/presences/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...patch, deviceId }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data?.error || 'Impossible de modifier cette présence.' };
        }
        const updated = data.record as PresenceRecord;
        setPresences((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        if (myReceipt && myReceipt.id === updated.id) {
          setMyReceipt(updated);
          saveLocalReceipt(updated);
        }
        return { ok: true, record: updated };
      } catch {
        return { ok: false, error: 'Erreur réseau lors de la mise à jour.' };
      }
    },
    [deviceId, myReceipt]
  );

  const deletePresence = useCallback(
    async (id: string): Promise<boolean> => {
      // Optimistic removal
      const snapshot = presences;
      setPresences((prev) => prev.filter((p) => p.id !== id));
      if (myReceipt && myReceipt.id === id) {
        setMyReceipt(null);
        clearLocalReceipt();
      }
      try {
        const res = await fetch(`/api/presences/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Delete failed');
        return true;
      } catch {
        setPresences(snapshot);
        return false;
      }
    },
    [myReceipt, presences]
  );

  const clearAllPresences = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/presences/clear', { method: 'POST' });
      if (!res.ok) return false;
      setPresences([]);
      setMyReceipt(null);
      clearLocalReceipt();
      return true;
    } catch {
      return false;
    }
  }, []);

  const updateSession = useCallback(
    async (patch: Partial<EventSessionConfig>): Promise<boolean> => {
      try {
        const res = await fetch('/api/session', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setSession(data.session as EventSessionConfig);
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const resetDeviceSession = useCallback(() => {
    const newDevId = resetLocalDeviceForTesting();
    setDeviceId(newDevId);
    setMyReceipt(null);
  }, []);

  return {
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
  };
}
