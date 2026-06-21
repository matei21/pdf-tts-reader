export type SpeedOption = 0.75 | 1.0 | 1.25 | 1.5 | 2.0;

export const SPEED_OPTIONS: SpeedOption[] = [0.75, 1.0, 1.25, 1.5, 2.0];

const ALLOWED_LANGS = ["en", "ro"];

export function getVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis
    .getVoices()
    .filter((v) => ALLOWED_LANGS.some((lang) => v.lang.startsWith(lang)));
}

let currentText = "";
let lastCharIndex = 0;

export function speak(
  text: string,
  voice: SpeechSynthesisVoice | null,
  rate: SpeedOption,
  onEnd?: () => void,
): SpeechSynthesisUtterance {
  window.speechSynthesis.cancel();

  currentText = text;
  lastCharIndex = 0;

  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) utterance.voice = voice;
  utterance.rate = rate;
  utterance.pitch = 1;

  utterance.onboundary = (e) => {
    lastCharIndex = e.charIndex;
  };

  if (onEnd) utterance.onend = onEnd;

  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeaking() {
  window.speechSynthesis.cancel();
  currentText = "";
  lastCharIndex = 0;
}

export function pauseSpeaking() {
  window.speechSynthesis.pause();
}

export function resumeWithSettings(
  voice: SpeechSynthesisVoice | null,
  rate: SpeedOption,
  onEnd?: () => void,
): void {
  window.speechSynthesis.cancel();

  const remaining = currentText.substring(lastCharIndex);
  if (!remaining.trim()) {
    onEnd?.();
    return;
  }

  currentText = remaining;
  lastCharIndex = 0;

  const utterance = new SpeechSynthesisUtterance(remaining);
  if (voice) utterance.voice = voice;
  utterance.rate = rate;
  utterance.pitch = 1;

  utterance.onboundary = (e) => {
    lastCharIndex = e.charIndex;
  };

  if (onEnd) utterance.onend = onEnd;

  window.speechSynthesis.speak(utterance);
}

export function isSpeaking() {
  return window.speechSynthesis.speaking;
}

export function isPaused() {
  return window.speechSynthesis.paused;
}
