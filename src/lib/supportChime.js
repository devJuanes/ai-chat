const heard = new Set();
let clip = null;

function notification() {
  if (!clip) {
    clip = new Audio('/notification.mp3');
    clip.preload = 'auto';
    clip.loop = false;
  }
  return clip;
}

/** Call from a click or tap so later messages can play after autoplay limits. */
export function unlockSupportChime() {
  const node = notification();
  node.muted = true;
  const pending = node.play();
  const finish = () => {
    node.pause();
    node.currentTime = 0;
    node.muted = false;
  };
  if (pending && typeof pending.then === 'function') pending.then(finish).catch(() => {});
  else finish();
}

export function playSupportChime() {
  const node = notification();
  node.muted = false;
  node.loop = false;
  try {
    node.currentTime = 0;
  } catch {
    /* the clip may not be seekable yet */
  }
  const pending = node.play();
  if (pending && typeof pending.catch === 'function') pending.catch(() => {});
}

/** Remember these messages without playing. Use for the first snapshot. */
export function seedSupportChime(messages) {
  for (const item of messages || []) {
    if (item?.id) heard.add(item.id);
  }
}

/**
 * Play once when a new incoming message shows up.
 * sinceIso, when set, ignores anything at or before that timestamp.
 */
export function notifyIncoming(messages, isIncoming, sinceIso = '') {
  let play = false;
  for (const item of messages || []) {
    if (!item?.id || heard.has(item.id)) continue;
    heard.add(item.id);
    if (!isIncoming(item)) continue;
    if (sinceIso && String(item.created_at) <= String(sinceIso)) continue;
    play = true;
  }
  if (play) playSupportChime();
}
