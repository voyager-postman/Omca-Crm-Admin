/**
 * Continuous emergency siren for SOS alerts (not a beep).
 * Runs until clearSosAlarm(sosId) / stopAllSosAlarms().
 * Accepted / silenced IDs never restart the siren.
 */

let audioCtx = null;
let sirenNodes = null;
const ringingIds = new Set();
/** After accept/close — never ring again for these ids this session */
const silencedIds = new Set();

const ensureAudioCtx = async () => {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch {
      /* blocked until user gesture */
    }
  }
  return audioCtx;
};

export const unlockSosAudio = () => {
  ensureAudioCtx();
};

/**
 * While any SOS is ringing but audio is blocked/suspended, resume on the
 * next user gesture (covers "silent" alerts that arrived without autoplay).
 * Skips Accept/Close clicks so sound does not start on those actions.
 */
export const bindSosAlarmGestureResume = () => {
  if (typeof window === "undefined") return () => {};

  const resumeIfNeeded = (event) => {
    if (ringingIds.size === 0) return;
    const target = event?.target;
    if (
      target?.closest?.(
        '[data-sos-accept], [data-sos-close], .ems-action-btn-done',
      )
    ) {
      return;
    }
    ensureAudioCtx().then((ctx) => {
      if (!ctx || ringingIds.size === 0) return;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      if (!sirenNodes && ringingIds.size > 0) {
        startSirenGraph();
      }
    });
  };

  window.addEventListener("pointerdown", resumeIfNeeded, true);
  window.addEventListener("keydown", resumeIfNeeded, true);
  window.addEventListener("touchstart", resumeIfNeeded, true);
  return () => {
    window.removeEventListener("pointerdown", resumeIfNeeded, true);
    window.removeEventListener("keydown", resumeIfNeeded, true);
    window.removeEventListener("touchstart", resumeIfNeeded, true);
  };
};

const stopSirenGraph = () => {
  if (!sirenNodes || !audioCtx) {
    sirenNodes = null;
    return;
  }
  try {
    const { oscillators, gains } = sirenNodes;
    const now = audioCtx.currentTime;
    const master = sirenNodes.master;
    if (master) {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    }
    setTimeout(() => {
      (oscillators || []).forEach((o) => {
        try {
          o.stop();
          o.disconnect();
        } catch {
          /* ignore */
        }
      });
      (gains || []).forEach((g) => {
        try {
          g.disconnect();
        } catch {
          /* ignore */
        }
      });
    }, 250);
  } catch {
    /* ignore */
  }
  sirenNodes = null;
};

/**
 * Continuous emergency / ambulance wail alert.
 */
const startSirenGraph = async () => {
  const ctx = await ensureAudioCtx();
  if (!ctx) return false;
  if (ctx.state !== "running") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  if (ctx.state !== "running") return false;
  if (sirenNodes) return true;

  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);
  master.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.1);

  // Voice 1 — main siren wail
  const osc1 = ctx.createOscillator();
  osc1.type = "sawtooth";
  const gain1 = ctx.createGain();
  gain1.gain.value = 0.5;
  osc1.connect(gain1);
  gain1.connect(master);

  // Voice 2 — higher alert overtone
  const osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  const gain2 = ctx.createGain();
  gain2.gain.value = 0.28;
  osc2.connect(gain2);
  gain2.connect(master);

  // Slow sine LFO = classic emergency siren sweep
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.75;
  const lfoDepth1 = ctx.createGain();
  lfoDepth1.gain.value = 320;
  const lfoDepth2 = ctx.createGain();
  lfoDepth2.gain.value = 480;
  lfo.connect(lfoDepth1);
  lfo.connect(lfoDepth2);

  osc1.frequency.value = 780;
  osc2.frequency.value = 1170;
  lfoDepth1.connect(osc1.frequency);
  lfoDepth2.connect(osc2.frequency);

  const t = ctx.currentTime;
  osc1.start(t);
  osc2.start(t);
  lfo.start(t);

  sirenNodes = {
    master,
    oscillators: [osc1, osc2, lfo],
    gains: [master, gain1, gain2, lfoDepth1, lfoDepth2],
  };
  return true;
};

export const startSosAlarm = async (sosId) => {
  const id = sosId ? String(sosId) : null;
  if (id && silencedIds.has(id)) return;
  if (id) ringingIds.add(id);
  if (ringingIds.size === 0) return;

  const ok = await startSirenGraph();
  if (!ok) {
    // Retry a few times — autoplay often unlocks after first page click
    let attempts = 0;
    const retry = () => {
      attempts += 1;
      if (ringingIds.size === 0) return;
      startSirenGraph().then((started) => {
        if (!started && attempts < 8) {
          setTimeout(retry, 400);
        }
      });
    };
    setTimeout(retry, 400);
  }
};

/** Stop alarm for one SOS. Pass { permanent: true } after accept/close. */
export const clearSosAlarm = (sosId, { permanent = false } = {}) => {
  if (sosId) {
    const id = String(sosId);
    ringingIds.delete(id);
    if (permanent) silencedIds.add(id);
  }
  if (ringingIds.size === 0) {
    stopSirenGraph();
  }
};

export const silenceSosAlarm = (sosId) => {
  clearSosAlarm(sosId, { permanent: true });
};

export const unsilenceSosAlarm = (sosId) => {
  if (sosId) silencedIds.delete(String(sosId));
};

export const stopAllSosAlarms = () => {
  ringingIds.clear();
  stopSirenGraph();
};

export const isSosAlarmRinging = (sosId) =>
  sosId ? ringingIds.has(String(sosId)) : ringingIds.size > 0 || !!sirenNodes;

export const isSosAlarmSilenced = (sosId) =>
  sosId ? silencedIds.has(String(sosId)) : false;

export const getRingingSosIds = () => Array.from(ringingIds);

/**
 * Play a high-priority emergency alert chime for SOS Director announcements
 */
export const playDirectorAlertChime = async () => {
  try {
    const ctx = await ensureAudioCtx();
    if (!ctx) return false;
    if (ctx.state !== "running") {
      await ctx.resume().catch(() => {});
    }
    if (ctx.state !== "running") return false;

    const t = ctx.currentTime;
    const playTone = (freq, startTime, duration, gainVal = 0.25) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(gainVal, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Urgent three-tone emergency chime: A5 (880Hz) -> E6 (1320Hz) -> A6 (1760Hz)
    playTone(880, t, 0.25, 0.3);
    playTone(1320, t + 0.15, 0.32, 0.35);
    playTone(1760, t + 0.32, 0.45, 0.25);
    return true;
  } catch (err) {
    console.warn("Failed to play director alert chime:", err);
    return false;
  }
};

/** @deprecated */
export const playSosBeep = () => startSosAlarm();
