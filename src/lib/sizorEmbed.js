/** Persistencia del modo embed (iframe desde Sizor). */
const KEY = 'matu_ai_sizor_embed';

export function setSizorEmbed(enabled) {
  try {
    if (enabled) sessionStorage.setItem(KEY, '1');
    else sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

export function isSizorEmbed() {
  try {
    if (typeof window === 'undefined') return false;
    const q = new URLSearchParams(window.location.search);
    if (q.get('embed') === '1') {
      setSizorEmbed(true);
      return true;
    }
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
