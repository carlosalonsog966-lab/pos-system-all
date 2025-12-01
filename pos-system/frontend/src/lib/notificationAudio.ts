import { useNotificationPrefsStore } from '@/store/notificationPrefsStore';
import type { NotificationType } from '@/store/notificationPrefsStore';

// Generador de tonos simples con Web Audio para evitar depender de assets
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  
  // Resumir contexto si está suspendido (política de autoplay)
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  
  return audioContext;
}

function createTone(freq: number, durationMs: number, volume: number) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = Math.min(1, Math.max(0, volume));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
    }, durationMs);
  } catch {
    // Silenciosamente ignorar si el navegador bloquea audio sin interacción
  }
}

function getToneForType(type: NotificationType): { freq: number; duration: number } {
  switch (type) {
    case 'success':
      return { freq: 880, duration: 140 };
    case 'error':
      return { freq: 300, duration: 220 };
    case 'warning':
      return { freq: 520, duration: 180 };
    case 'info':
    default:
      return { freq: 660, duration: 160 };
  }
}

export function playNotificationSound(type: NotificationType) {
  const prefs = useNotificationPrefsStore.getState();
  if (!prefs.enableSound) return;
  if (prefs.mutedTypes.includes(type)) return;
  const { freq, duration } = getToneForType(type);
  createTone(freq, duration, prefs.volume);
}

