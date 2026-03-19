"use client";

import { useRef } from "react";
import type { InsightRarity } from "@/types/index";

export function useRevealSound(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  function ctx(): AudioContext {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return ctxRef.current;
  }

  function tone(
    audioCtx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine"
  ) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  function playCommon() {
    const ac = ctx();
    const t = ac.currentTime;
    tone(ac, 720, t, 0.07, 0.06, "sine");
  }

  function playUncommon() {
    const ac = ctx();
    const t = ac.currentTime;
    tone(ac, 520, t, 0.08, 0.07, "sine");
    tone(ac, 780, t + 0.04, 0.12, 0.07, "sine");
  }

  function playRare() {
    const ac = ctx();
    const t = ac.currentTime;
    // Two ascending notes — E4 then A4
    tone(ac, 330, t, 0.25, 0.09, "sine");
    tone(ac, 440, t + 0.1, 0.35, 0.09, "sine");
  }

  function playEpic() {
    const ac = ctx();
    const t = ac.currentTime;
    // C4-E4-G4 rising arpeggio with shimmer
    tone(ac, 261.6, t, 0.3, 0.08, "sine");
    tone(ac, 329.6, t + 0.08, 0.35, 0.08, "sine");
    tone(ac, 392.0, t + 0.16, 0.4, 0.08, "sine");
    // Shimmer: high partial
    tone(ac, 1046.5, t + 0.25, 0.3, 0.04, "sine");
  }

  function playLegendary() {
    const ac = ctx();
    const t = ac.currentTime;
    // Rising C major chord: C3→C4→E4→G4→C5, wide sustain
    tone(ac, 130.8, t, 1.0, 0.07, "sine");
    tone(ac, 261.6, t + 0.06, 1.1, 0.07, "triangle");
    tone(ac, 329.6, t + 0.12, 1.0, 0.07, "sine");
    tone(ac, 392.0, t + 0.18, 0.9, 0.07, "sine");
    tone(ac, 523.3, t + 0.24, 1.2, 0.08, "sine");
    // Resonant high shimmer
    tone(ac, 1046.5, t + 0.35, 0.7, 0.05, "sine");
    tone(ac, 1318.5, t + 0.42, 0.6, 0.04, "sine");
  }

  function playRarity(rarity: InsightRarity) {
    if (muted) return;
    try {
      switch (rarity) {
        case "common":    playCommon();    break;
        case "uncommon":  playUncommon();  break;
        case "rare":      playRare();      break;
        case "epic":      playEpic();      break;
        case "legendary": playLegendary(); break;
      }
    } catch {
      // Web Audio failures are non-fatal
    }
  }

  return { playRarity };
}
