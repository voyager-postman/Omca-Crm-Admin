/**
 * Call audio synthesizer using Web Audio API.
 * Provides reliable ringtone and ringback tones across all browsers
 * without requiring external MP3 assets that might fail to load.
 */

let audioCtx = null;
let currentOscillators = [];
let loopTimer = null;

const getAudioContext = () => {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (err) {
    console.warn("AudioContext initialization skipped (no active audio driver/output):", err);
    return null;
  }
};

export const stopAudio = () => {
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
  currentOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch (_) {}
  });
  currentOscillators = [];
};

/**
 * Incoming call ringtone (dual frequency European/modern ring tone with cadence)
 */
export const playRingtone = () => {
  stopAudio();
  const ctx = getAudioContext();
  if (!ctx) return;

  const playToneBurst = (freq1, freq2, durationSec) => {
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(freq1, now);
      osc2.frequency.setValueAtTime(freq2, now);

      // Envelope
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gainNode.gain.setValueAtTime(0.2, now + durationSec - 0.05);
      gainNode.gain.linearRampToValueAtTime(0, now + durationSec);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + durationSec);
      osc2.stop(now + durationSec);

      currentOscillators.push(osc1, osc2);
    } catch (_) {}
  };

  const scheduleRingCycle = () => {
    // Ring 1 (440Hz + 480Hz for 0.4s), pause 0.2s, Ring 2 (440Hz + 480Hz for 0.4s), pause 2s
    playToneBurst(523.25, 659.25, 0.4); // C5 + E5
    setTimeout(() => {
      playToneBurst(587.33, 783.99, 0.4); // D5 + G5
    }, 500);

    loopTimer = setTimeout(scheduleRingCycle, 2500);
  };

  scheduleRingCycle();
};

/**
 * Outgoing call ringback tone (standard phone line dialing cadence)
 */
export const playRingback = () => {
  stopAudio();
  const ctx = getAudioContext();
  if (!ctx) return;

  const scheduleRingbackCycle = () => {
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      // US standard ringback: 2s tone, 4s silence (we use 1.5s tone, 2.5s silence for crisp UX)
      const duration = 1.5;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gainNode.gain.setValueAtTime(0.12, now + duration - 0.05);
      gainNode.gain.linearRampToValueAtTime(0, now + duration);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);

      currentOscillators.push(osc1, osc2);
      loopTimer = setTimeout(scheduleRingbackCycle, 3500);
    } catch (_) {}
  };

  scheduleRingbackCycle();
};

/**
 * Modern chat message chime (pleasant double-ding like Teams / Slack)
 */
export const playMessageChime = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";
    // F6 (1396.91 Hz) then A6 (1760.00 Hz)
    osc1.frequency.setValueAtTime(1396.91, now);
    osc2.frequency.setValueAtTime(1760.0, now + 0.08);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.08);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.38);
  } catch (_) {}
};

