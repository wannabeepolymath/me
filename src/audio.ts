/* ---------------- sound: all synthesized ---------------- */
interface NoiseOptions {
  vol?: number;
  f?: number;
  q?: number;
  dur?: number;
  when?: number;
  type?: BiquadFilterType;
  f2?: number;
}

let ac: AudioContext | null = null, soundOn = true, noiseBuf: AudioBuffer | null = null;
export function toggleSound(): boolean { soundOn = !soundOn; return soundOn; }
export function audio(): AudioContext | null {
  if (!ac) { try { ac = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)(); } catch (e) { return null; } }
  if (ac.state === 'suspended') ac.resume();
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return ac;
}
function noiseHit({ vol = 0.2, f = 3000, q = 0.9, dur = 0.035, when = 0, type = 'bandpass', f2 }: NoiseOptions = {}) {
  if (!soundOn || !ac || ac.state !== 'running') return;
  const t = ac.currentTime + when, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f * (0.85 + Math.random() * 0.3), t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.004, dur / 3)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(gn).connect(ac.destination); s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.03);
}
export const sfx = {
  lay: (when = 0) => { noiseHit({ vol: 0.16, f: 3400, dur: 0.028, when }); noiseHit({ vol: 0.08, f: 420, type: 'lowpass', dur: 0.05, when }); },
  swish: (dur = 0.32) => noiseHit({ vol: 0.07, f: 900, f2: 2600, q: 0.6, dur }),
  flip: (when = 0) => { noiseHit({ vol: 0.05, f: 1500, f2: 4200, q: 0.7, dur: 0.07, when }); noiseHit({ vol: 0.12, f: 3800, dur: 0.02, when: when + 0.06 }); },
  lift: () => { noiseHit({ vol: 0.09, f: 2600, f2: 1200, q: 0.8, dur: 0.12 }); },
  riffle: (n: number) => { for (let i = 0; i < n; i++) noiseHit({ vol: 0.06 + 0.1 * (i / n), f: 3600, dur: 0.018, when: i * 0.026 }); }
};

