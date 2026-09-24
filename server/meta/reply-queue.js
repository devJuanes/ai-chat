/**
 * Per-contact debounce for Meta bot AI replies (inspired by Sizor).
 * Inbound messages are already persisted; this only coalesces LLM runs.
 */

const DEBOUNCE_MS = 2500;
const REFLUSH_MS = 600;

/** @type {Map<string, { timer: ReturnType<typeof setTimeout>|null, waiters: Function[], pendingFn: Function|null, processing: boolean }>} */
const queues = new Map();

/**
 * @param {string} key connectionId::externalUserId
 * @param {() => Promise<any>} fn
 */
export function enqueueDebouncedReply(key, fn) {
  return new Promise((resolve) => {
    let q = queues.get(key);
    if (!q) {
      q = {
        timer: null,
        waiters: [],
        pendingFn: null,
        processing: false,
      };
      queues.set(key, q);
    }
    // Keep latest work unit — history in DB already has every inbound msg
    q.pendingFn = fn;
    q.waiters.push(resolve);
    if (q.timer) clearTimeout(q.timer);
    if (!q.processing) {
      q.timer = setTimeout(() => flushQueue(key), DEBOUNCE_MS);
    }
  });
}

async function flushQueue(key) {
  const q = queues.get(key);
  if (!q) return;
  if (q.processing) return;
  if (!q.pendingFn) {
    queues.delete(key);
    return;
  }

  q.processing = true;
  if (q.timer) {
    clearTimeout(q.timer);
    q.timer = null;
  }
  const fn = q.pendingFn;
  const waiters = q.waiters.splice(0);
  q.pendingFn = null;

  let result = { ok: false };
  try {
    result = await fn();
  } catch (err) {
    result = { error: err?.message || String(err) };
  }

  for (const w of waiters) {
    try {
      w(result);
    } catch {
      /* ignore */
    }
  }

  q.processing = false;

  if (q.pendingFn) {
    q.timer = setTimeout(() => flushQueue(key), REFLUSH_MS);
  } else {
    queues.delete(key);
  }
}
