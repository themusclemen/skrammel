// Ljudeffekter genererade direkt via Web Audio API — inga ljudfiler att
// hämta/hantera. AudioContext skapas lat (första gången ett ljud spelas,
// alltid efter en användarinteraktion som ett knapptryck) för att undvika
// webbläsares autoplay-spärrar.
let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playTone(ctx, freq, startTime, duration, { type = "sine", gain = 0.15 } = {}) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gainNode.gain.setValueAtTime(gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function playClickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 720, ctx.currentTime, 0.06, { type: "square", gain: 0.07 });
}

export function playFanfareSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    playTone(ctx, freq, now + i * 0.08, 0.18, { type: "triangle", gain: 0.12 });
  });
}
