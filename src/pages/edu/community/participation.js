/**
 * Preferencia de este navegador: retos, grupos y formatos que la persona apartó.
 * No cuenta miembros ni asistencia de nadie más.
 */

const KEY = 'edu.community.participation.v1';

const EMPTY = { challenges: {}, groups: {}, events: {} };

export function readParticipation() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      challenges: raw.challenges && typeof raw.challenges === 'object' ? raw.challenges : {},
      groups: raw.groups && typeof raw.groups === 'object' ? raw.groups : {},
      events: raw.events && typeof raw.events === 'object' ? raw.events : {},
    };
  } catch {
    return { ...EMPTY, challenges: {}, groups: {}, events: {} };
  }
}

export function writeParticipation(next) {
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
