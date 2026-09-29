import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { COMPANY_NAME, COMPANY_URL, db } from './matudb';
import { api } from './api';
import { apiUrl, readJsonResponse } from './apiBase';

const SESSION_KEY = 'matu_ai_session';

function normalizeUser(user) {
  if (!user) return null;
  const id = user.id || user.user_id || user.sub;
  const email = user.email;
  if (!id || !email) return null;
  return {
    id: String(id),
    email: String(email),
    name:
      user.name ||
      user.display_name ||
      String(email).split('@')[0] ||
      'Usuario',
  };
}

function sessionFromMatu(session, userOverride) {
  if (!session?.access_token) return null;
  const user = normalizeUser(userOverride || session.user);
  if (!user) return null;
  return {
    access_token: session.access_token,
    token_type: session.token_type || 'bearer',
    expires_at:
      session.expires_at || Math.floor(Date.now() / 1000) + 86400,
    user,
  };
}

function readLocalSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return sessionFromMatu(session, session.user);
  } catch {
    return null;
  }
}

function writeLocalSession(session) {
  try {
    if (session?.access_token && session?.user?.id) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* noop */
  }
}

/** Tras login MatuDB, asegura perfil/org en nuestro schema (si el API está). */
async function bootstrapWorkspace(token) {
  if (!token) return null;
  try {
    const res = await fetch(apiUrl('/api/me'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await readJsonResponse(res).catch(() => null);
  } catch {
    return null;
  }
}

function friendlyAuthError(message, mode) {
  const raw = String(message || '').toLowerCase();
  if (
    raw.includes('invalid') ||
    raw.includes('incorrect') ||
    raw.includes('credential') ||
    raw.includes('password') ||
    raw.includes('unauthorized') ||
    raw.includes('not found') ||
    raw.includes('no encontrado')
  ) {
    return mode === 'register'
      ? 'No se pudo crear la cuenta. Ese correo quizás ya está registrado.'
      : 'Correo o contraseña incorrectos';
  }
  if (raw.includes('already') || raw.includes('exists') || raw.includes('existe')) {
    return 'Ese correo ya tiene una cuenta. Inicia sesión.';
  }
  if (raw.includes('network') || raw.includes('fetch')) {
    return 'No pudimos conectar. Revisa tu internet e inténtalo de nuevo.';
  }
  return (
    message ||
    (mode === 'register'
      ? 'No se pudo registrar'
      : 'Correo o contraseña incorrectos')
  );
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() =>
    typeof window !== 'undefined' ? readLocalSession() : null
  );
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const user = session?.user ?? null;

  // Hidrata sesión desde MatuDB (fuente de verdad)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await db.auth.getSession();
        const next = sessionFromMatu(data?.session);
        if (cancelled) return;
        if (next) {
          writeLocalSession(next);
          setSession(next);
        } else {
          const local = readLocalSession();
          if (local) {
            setSession(local);
          } else {
            writeLocalSession(null);
            setSession(null);
          }
        }
      } catch {
        if (!cancelled) {
          const local = readLocalSession();
          setSession(local);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Escucha cambios de MatuDB auth
  useEffect(() => {
    const { data } = db.auth.onAuthStateChange((event, matuSession) => {
      if (event === 'SIGNED_OUT') {
        writeLocalSession(null);
        setSession(null);
        setProfile(null);
        return;
      }
      const next = sessionFromMatu(matuSession);
      if (next) {
        writeLocalSession(next);
        setSession(next);
      }
    });
    return () => data?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!session?.access_token) {
      setProfile(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const json = await bootstrapWorkspace(session.access_token);
      if (cancelled || !json) return;
      setProfile(json);
      if (json.user?.name || json.user?.email) {
        setSession((prev) => {
          if (!prev) return prev;
          const merged = {
            ...prev,
            user: {
              ...prev.user,
              name: json.user.name || prev.user.name,
              email: json.user.email || prev.user.email,
            },
          };
          writeLocalSession(merged);
          return merged;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      companyName: COMPANY_NAME,
      companyUrl: COMPANY_URL,
      setProfile,
      updateUser(nextUser) {
        setSession((prev) => {
          if (!prev) return prev;
          const merged = { ...prev, user: { ...prev.user, ...nextUser } };
          writeLocalSession(merged);
          return merged;
        });
      },
      async signIn(email, password) {
        const cleanEmail = String(email || '')
          .trim()
          .toLowerCase();
        const cleanPassword = String(password || '');
        if (!cleanEmail || !cleanPassword) {
          throw new Error('Escribe tu correo y contraseña');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          throw new Error('El correo no es válido');
        }

        const { data, error } = await db.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (error) {
          throw new Error(friendlyAuthError(error.message, 'login'));
        }

        const next = sessionFromMatu(data?.session, data?.user);
        if (!next) {
          throw new Error('Correo o contraseña incorrectos');
        }

        writeLocalSession(next);
        setSession(next);
        await bootstrapWorkspace(next.access_token);
        return { user: next.user, session: next };
      },
      async requestSignupCode(email, password, name) {
        const cleanEmail = String(email || '')
          .trim()
          .toLowerCase();
        const cleanPassword = String(password || '');
        const cleanName = String(name || cleanEmail.split('@')[0]).trim();
        if (!cleanEmail || !cleanPassword) {
          throw new Error('Email y contraseña son requeridos');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          throw new Error('El correo no es válido');
        }
        if (cleanPassword.length < 8) {
          throw new Error('La contraseña debe tener al menos 8 caracteres');
        }
        return api('/api/auth/register/code', {
          method: 'POST',
          body: { email: cleanEmail, password: cleanPassword, name: cleanName },
        });
      },
      async confirmSignup(email, code, password) {
        const cleanEmail = String(email || '')
          .trim()
          .toLowerCase();
        const json = await api('/api/auth/register/confirm', {
          method: 'POST',
          body: { email: cleanEmail, code },
        });

        let next = null;
        if (password) {
          const { data, error } = await db.auth.signInWithPassword({
            email: cleanEmail,
            password: String(password),
          });
          if (!error) next = sessionFromMatu(data?.session, data?.user);
        }
        if (!next && json?.token && json?.user?.id) {
          next = {
            access_token: json.token,
            token_type: 'bearer',
            expires_at: Math.floor(Date.now() / 1000) + 86400,
            user: {
              id: String(json.user.id),
              email: String(json.user.email || cleanEmail),
              name: json.user.name || cleanEmail.split('@')[0],
            },
          };
        }
        if (!next) throw new Error('No se pudo crear la cuenta');
        if (json?.user?.name) next.user.name = json.user.name;
        writeLocalSession(next);
        setSession(next);
        await bootstrapWorkspace(next.access_token);
        return { user: next.user, session: next };
      },
      /**
       * Pide a MatuDB el correo de recuperación.
       * `db.auth.resetPasswordForEmail` hace POST /auth/recover; el servidor envía el enlace.
       * Si la cuenta no existe, devolvemos el mismo ok para no revelarlo.
       */
      async requestPasswordReset(email) {
        const cleanEmail = String(email || '')
          .trim()
          .toLowerCase();
        if (!cleanEmail) {
          throw new Error('Escribe tu correo');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          throw new Error('El correo no es válido');
        }

        const { error } = await db.auth.resetPasswordForEmail(cleanEmail);
        if (error) {
          const raw = String(error.message || '').toLowerCase();
          const missingAccount =
            raw.includes('not found') ||
            raw.includes('no encontr') ||
            raw.includes('does not exist') ||
            raw.includes('no existe') ||
            raw.includes('unknown user') ||
            raw.includes('no user') ||
            raw.includes('user not');
          if (missingAccount) return { ok: true };

          if (
            raw.includes('network') ||
            raw.includes('fetch') ||
            raw.includes('failed to fetch')
          ) {
            throw new Error(
              'No pudimos conectar. Revisa tu internet e inténtalo de nuevo.'
            );
          }
          if (!error.message || raw === 'error requesting recovery') {
            throw new Error(
              'No pudimos enviar el enlace. Inténtalo de nuevo.'
            );
          }
          throw new Error(error.message);
        }
        return { ok: true };
      },
      async signOut({ redirectTo = '/' } = {}) {
        try {
          await db.auth.signOut();
        } catch {
          /* noop */
        }
        writeLocalSession(null);
        setSession(null);
        setProfile(null);
        if (typeof window !== 'undefined' && redirectTo != null) {
          window.location.assign(redirectTo);
        }
      },
      getToken() {
        const fromClient = db.auth.getAccessToken?.();
        if (fromClient) return fromClient;
        if (session?.access_token) return session.access_token;
        return readLocalSession()?.access_token || null;
      },
      isAuthenticated() {
        const token =
          db.auth.getAccessToken?.() ||
          session?.access_token ||
          readLocalSession()?.access_token;
        const uid = session?.user?.id || readLocalSession()?.user?.id;
        return Boolean(token && uid);
      },
    }),
    [session, user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
