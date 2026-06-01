
let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    console.error("Failed to play sound", e);
  }
}

export const soundEffects = {
  click: () => playTone(600, "sine", 0.05, 0.1),
  reveal: () => playTone(800, "sine", 0.05, 0.05),
  flag: () => playTone(400, "sine", 0.1, 0.1),
  win: () => {
    playTone(523.25, "triangle", 0.1, 0.1); // C5
    setTimeout(() => playTone(659.25, "triangle", 0.1, 0.1), 100); // E5
    setTimeout(() => playTone(783.99, "triangle", 0.3, 0.1), 200); // G5
  },
  lose: () => {
    playTone(200, "sawtooth", 0.2, 0.1);
    setTimeout(() => playTone(150, "sawtooth", 0.4, 0.1), 100);
  }
};
