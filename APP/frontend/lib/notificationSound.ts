/**
 * notificationSound — Pitido de aviso para notificaciones en PRIMER PLANO.
 *
 * Cuando la app está abierta, FCM entrega el mensaje vía onMessage y NO muestra
 * notificación del sistema (ni sonido). Antes solo se mostraba un toast mudo, así
 * que los avisos pasaban desapercibidos en el taller. Aquí generamos un pitido
 * con Web Audio (sin archivo de audio → funciona offline y sin assets).
 *
 * Autoplay: el navegador permite reproducir audio tras una interacción del
 * usuario. Como en primer plano el operario ya ha interactuado con la app, el
 * AudioContext puede sonar; si estuviera suspendido intentamos reanudarlo.
 */

let audioCtx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
};

/**
 * Reproduce un breve chime de aviso. `urgent` usa tres tonos más marcados.
 */
export const playNotificationSound = (urgent = false): void => {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Tonos (Hz): aviso normal = dos notas ascendentes; urgente = triple más agudo.
  const tones = urgent ? [880, 1175, 880] : [784, 1047];
  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.16;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  });
};
