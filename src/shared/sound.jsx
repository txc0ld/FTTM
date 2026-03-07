import { createContext, useContext, useState, useRef, useCallback } from "react";

const SoundContext = createContext();

function getCtx(ref) {
  if (!ref.current) {
    ref.current = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ref.current;
}

function playTone(actx, freq, duration, type = "square", gain = 0.08) {
  const osc = actx.createOscillator();
  const g = actx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + duration);
  osc.connect(g).connect(actx.destination);
  osc.start();
  osc.stop(actx.currentTime + duration);
}

export function SoundProvider({ children }) {
  const [muted, setMuted] = useState(() => localStorage.getItem("dt_sound_muted") === "true");
  const actxRef = useRef(null);

  const toggle = () => setMuted((m) => {
    localStorage.setItem("dt_sound_muted", !m ? "true" : "false");
    return !m;
  });

  const playTypewriter = useCallback(() => {
    if (muted) return;
    const actx = getCtx(actxRef);
    playTone(actx, 800 + Math.random() * 400, 0.05, "square", 0.04);
  }, [muted]);

  const playStamp = useCallback(() => {
    if (muted) return;
    const actx = getCtx(actxRef);
    playTone(actx, 120, 0.15, "sawtooth", 0.12);
    setTimeout(() => playTone(actx, 80, 0.1, "square", 0.06), 50);
  }, [muted]);

  const playStaticBuzz = useCallback(() => {
    if (muted) return;
    const actx = getCtx(actxRef);
    const bufferSize = actx.sampleRate * 0.08;
    const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.06;
    const src = actx.createBufferSource();
    src.buffer = buffer;
    src.connect(actx.destination);
    src.start();
  }, [muted]);

  const playClick = useCallback(() => {
    if (muted) return;
    const actx = getCtx(actxRef);
    playTone(actx, 600, 0.03, "square", 0.05);
  }, [muted]);

  return (
    <SoundContext.Provider value={{ muted, toggle, playTypewriter, playStamp, playStaticBuzz, playClick }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  return useContext(SoundContext);
}
