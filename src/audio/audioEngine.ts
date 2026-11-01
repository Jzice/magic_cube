import { state } from '../core/state';

/** 首次交互时初始化 AudioContext（浏览器自动播放策略要求）。 */
export function initAudio(): void {
  if (state.isMuted) return;
  if (!state.audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    state.audioCtx = new Ctor();
  }
  if (state.audioCtx.state === 'suspended') {
    void state.audioCtx.resume();
  }
}

/** 转层“咔哒”声（低频振荡 + 高频摩擦）。 */
export function playMoveSound(): void {
  if (state.isMuted || !state.audioCtx) return;
  const now = state.audioCtx.currentTime;

  const osc = state.audioCtx.createOscillator();
  const gain = state.audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(250 + Math.random() * 100, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.06);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
  osc.connect(gain);
  gain.connect(state.audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.1);

  const osc2 = state.audioCtx.createOscillator();
  const gain2 = state.audioCtx.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(1200, now);
  osc2.frequency.exponentialRampToValueAtTime(400, now + 0.04);
  gain2.gain.setValueAtTime(0.03, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  osc2.connect(gain2);
  gain2.connect(state.audioCtx.destination);
  osc2.start(now);
  osc2.stop(now + 0.05);
}

/** 还原完成的胜利琶音（C5-E5-G5-C6）。 */
export function playWinSound(): void {
  if (state.isMuted || !state.audioCtx) return;
  const now = state.audioCtx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const osc = state.audioCtx!.createOscillator();
    const gain = state.audioCtx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.1;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, start + 0.3);
    osc.connect(gain);
    gain.connect(state.audioCtx!.destination);
    osc.start(start);
    osc.stop(start + 0.35);
  });
}
