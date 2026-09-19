export function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function textForSpeech(raw = '') {
  return String(raw)
    .replace(/<think(?:ing)?[\s\S]*?<\/think(?:ing)?>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~>]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreVoice(voice) {
  const name = `${voice.name} ${voice.lang}`.toLowerCase();
  let score = 0;
  if (voice.lang?.toLowerCase().startsWith('es')) score += 50;
  if (/es-co|es-mx|es-us|es-es/.test(name)) score += 20;
  if (/google/.test(name)) score += 30;
  if (/microsoft.*(sabina|elena|pablo|jorge|raul|paulina)/.test(name))
    score += 25;
  if (/neural|natural|premium|enhanced/.test(name)) score += 15;
  if (voice.localService) score += 5;
  return score;
}

let cachedVoice = null;

export function pickSpanishVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return cachedVoice;

  const ranked = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  cachedVoice = ranked[0] || null;
  return cachedVoice;
}

export function ensureVoicesLoaded() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve(null);
      return;
    }
    const ready = () => resolve(pickSpanishVoice());
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) {
      ready();
      return;
    }
    const onChange = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChange);
      ready();
    };
    window.speechSynthesis.addEventListener('voiceschanged', onChange);
    window.setTimeout(ready, 800);
  });
}

export function speakText(text, { rate = 1.05, pitch = 1, onEnd, onStart } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd?.();
    return null;
  }
  const clean = textForSpeech(text);
  if (!clean) {
    onEnd?.();
    return null;
  }

  window.speechSynthesis.cancel();

  // Chrome can stall long utterances; speak in sentence-sized chunks.
  const chunks = splitSpeakableChunks(clean);
  let index = 0;
  let cancelled = false;

  const speakNext = () => {
    if (cancelled || index >= chunks.length) {
      if (!cancelled) onEnd?.();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    const voice = pickSpanishVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'es-ES';
    } else {
      utterance.lang = 'es-ES';
    }
    utterance.rate = rate;
    utterance.pitch = pitch;
    if (index === 0) utterance.onstart = () => onStart?.();
    utterance.onend = () => {
      index += 1;
      speakNext();
    };
    utterance.onerror = () => {
      cancelled = true;
      onEnd?.();
    };
    window.speechSynthesis.speak(utterance);
  };

  speakNext();
  return {
    cancel() {
      cancelled = true;
      window.speechSynthesis.cancel();
    },
  };
}

export function stopSpeaking() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

/** Split into speakable chunks so playback can start before the full reply ends. */
export function splitSpeakableChunks(text) {
  const clean = textForSpeech(text);
  if (!clean) return [];
  const parts = clean.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [clean];
  return parts.map((p) => p.trim()).filter(Boolean);
}
