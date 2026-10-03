import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';

const empty = {
  balance: 0,
  unread: 0,
  streak: 0,
  groups: 0,
  admin: false,
  avatar: '',
  notifications: [],
  featured: null,
};

let cache = empty;
const listeners = new Set();
let timer = 0;
let token = '';

function emit(next) {
  cache = next;
  listeners.forEach((listener) => listener(cache));
}

export function refreshPulse(nextToken) {
  const current = nextToken || token;
  if (!current) return Promise.resolve(cache);
  token = current;
  return api('/api/edu/pulse', { token: current })
    .then((json) => {
      emit({ ...empty, ...json, notifications: json.notifications || [] });
      return cache;
    })
    .catch(() => cache);
}

function ensureTimer() {
  if (timer || !token) return;
  timer = window.setInterval(() => refreshPulse(token), 30000);
}

export function useEduPulse() {
  const auth = useAuth();
  const [data, setData] = useState(cache);

  useEffect(() => {
    listeners.add(setData);
    token = auth.getToken() || '';
    refreshPulse(token);
    ensureTimer();
    return () => listeners.delete(setData);
  }, [auth]);

  return data;
}
