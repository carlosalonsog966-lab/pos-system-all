import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationPrefsState {
  enableSound: boolean;
  volume: number; // 0.0 - 1.0
  mutedTypes: NotificationType[];
  rateLimitWindowMs: number; // ventana en ms
  rateLimitMaxPerWindow: number; // máximo por ventana y scope
}

interface NotificationPrefsActions {
  setEnableSound: (value: boolean) => void;
  setVolume: (value: number) => void;
  toggleMutedType: (type: NotificationType) => void;
  setRateLimitWindowMs: (value: number) => void;
  setRateLimitMaxPerWindow: (value: number) => void;
}

const STORAGE_KEY = 'notification-prefs:v1';

function loadPrefs(): NotificationPrefsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          enableSound: parsed.enableSound ?? true,
          volume: Math.min(1, Math.max(0, parsed.volume ?? 0.7)),
          mutedTypes: Array.isArray(parsed.mutedTypes) ? parsed.mutedTypes : [],
          rateLimitWindowMs: parsed.rateLimitWindowMs ?? 60000,
          rateLimitMaxPerWindow: parsed.rateLimitMaxPerWindow ?? 12,
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    enableSound: true,
    volume: 0.7,
    mutedTypes: [],
    rateLimitWindowMs: 60000,
    rateLimitMaxPerWindow: 12,
  };
}

function savePrefs(state: NotificationPrefsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export const useNotificationPrefsStore = create<NotificationPrefsState & NotificationPrefsActions>((set, _get) => ({
  ...loadPrefs(),

  setEnableSound: (value) => {
    set((s) => {
      const next = { ...s, enableSound: value };
      savePrefs(next);
      return next;
    });
  },
  setVolume: (value) => {
    const vol = Math.min(1, Math.max(0, value));
    set((s) => {
      const next = { ...s, volume: vol };
      savePrefs(next);
      return next;
    });
  },
  toggleMutedType: (type) => {
    set((s) => {
      const isMuted = s.mutedTypes.includes(type);
      const nextMuted = isMuted ? s.mutedTypes.filter(t => t !== type) : [...s.mutedTypes, type];
      const next = { ...s, mutedTypes: nextMuted };
      savePrefs(next);
      return next;
    });
  },
  setRateLimitWindowMs: (value) => {
    const v = Math.max(1000, value);
    set((s) => {
      const next = { ...s, rateLimitWindowMs: v };
      savePrefs(next);
      return next;
    });
  },
  setRateLimitMaxPerWindow: (value) => {
    const v = Math.max(1, Math.floor(value));
    set((s) => {
      const next = { ...s, rateLimitMaxPerWindow: v };
      savePrefs(next);
      return next;
    });
  },
}));
