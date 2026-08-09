/**
 * Kleine WebAudio-synth: geen audiobestanden nodig, dus geen laadtijd.
 */

let ctx: AudioContext | null = null;
let enabled = true;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setSound(on: boolean) {
  enabled = on;
}

export function soundEnabled() {
  return enabled;
}

type ToneOpts = {
  freq: number;
  type?: OscillatorType;
  dur?: number;
  gain?: number;
  delay?: number;
  sweepTo?: number;
};

function tone({ freq, type = "sine", dur = 0.12, gain = 0.15, delay = 0, sweepTo }: ToneOpts) {
  const c = ac();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, sweepTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur = 0.09, gain = 0.12, hp = 1200, delay = 0) {
  const c = ac();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t0);
}

export const sfx = {
  unlock() {
    ac();
  },
  deal(i = 0) {
    noise(0.06, 0.09, 2600, i * 0.075);
  },
  flip() {
    noise(0.07, 0.13, 1800);
    tone({ freq: 520, type: "triangle", dur: 0.07, gain: 0.05 });
  },
  chip() {
    noise(0.05, 0.09, 3800);
    tone({ freq: 1650, type: "square", dur: 0.05, gain: 0.035 });
    tone({ freq: 2300, type: "square", dur: 0.04, gain: 0.025, delay: 0.045 });
  },
  check() {
    tone({ freq: 300, type: "sine", dur: 0.09, gain: 0.09 });
  },
  fold() {
    noise(0.13, 0.08, 900);
  },
  raise() {
    tone({ freq: 440, type: "sawtooth", dur: 0.14, gain: 0.07, sweepTo: 760 });
    noise(0.06, 0.07, 3200, 0.02);
  },
  allin() {
    tone({ freq: 220, type: "sawtooth", dur: 0.35, gain: 0.1, sweepTo: 880 });
    for (let i = 0; i < 5; i++) noise(0.05, 0.08, 3600, 0.06 * i);
  },
  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ freq: f, type: "triangle", dur: 0.28, gain: 0.11, delay: i * 0.085 })
    );
  },
  lose() {
    [392, 349.23, 293.66].forEach((f, i) =>
      tone({ freq: f, type: "sine", dur: 0.3, gain: 0.09, delay: i * 0.12 })
    );
  },
  bust() {
    tone({ freq: 180, type: "sawtooth", dur: 0.6, gain: 0.12, sweepTo: 60 });
  },
  victory() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      tone({ freq: f, type: "triangle", dur: 0.45, gain: 0.12, delay: i * 0.11 })
    );
  },
  click() {
    tone({ freq: 900, type: "square", dur: 0.035, gain: 0.045 });
  },
};
