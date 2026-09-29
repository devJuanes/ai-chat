import crypto from 'node:crypto';
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';

dns.setDefaultResultOrder('ipv4first');
import { config } from './config.js';
import { getDb, newId } from './db.js';
import { matudbLogin, matudbRegister } from './matudb-auth.js';

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function publicBase() {
  const raw = config.publicAppUrl || '';
  if (!raw || /localhost|127\.0\.0\.1/.test(raw)) return 'https://ai.matubyte.com';
  return raw.replace(/\/$/, '');
}

const BANNER_CID = 'matu-banner';

function bannerFile() {
  return path.join(config.root, 'public', 'matu-ai-banner.png');
}

function bannerSrc() {
  return fs.existsSync(bannerFile()) ? `cid:${BANNER_CID}` : `${publicBase()}/matu-ai-banner.png`;
}

function bannerAttachments() {
  const file = bannerFile();
  if (!fs.existsSync(file)) return [];
  return [
    {
      filename: 'matu-ai-banner.png',
      path: file,
      cid: BANNER_CID,
      contentDisposition: 'inline',
    },
  ];
}

function mailKey() {
  const raw = config.matudb.serviceKey || config.mail.pass || 'matu-email';
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', mailKey(), iv);
  const enc = Buffer.concat([
    cipher.update(String(plain), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptSecret(payload) {
  const buf = Buffer.from(String(payload || ''), 'base64');
  if (buf.length < 29) throw new Error('No se pudo leer el registro pendiente');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', mailKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function hashCode(email, purpose, code) {
  return crypto
    .createHash('sha256')
    .update(`${mailKey().toString('hex')}:${purpose}:${email}:${code}`)
    .digest('hex');
}

function codesMatch(stored, next) {
  const a = Buffer.from(String(stored || ''), 'hex');
  const b = Buffer.from(String(next || ''), 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function newCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function spaced(code) {
  return String(code).split('').join(' ');
}

function layout({ title, intro, extra }) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="es-CO">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Language" content="es-CO" />
  <meta name="language" content="es" />
  <title>${esc(title)}</title>
</head>
<body lang="es-CO" style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;" lang="es-CO">
    <tr>
      <td align="center" style="padding:40px 20px 48px;" lang="es-CO">
        <img src="${esc(bannerSrc())}" alt="Logotipo de Matu" width="320" style="display:block;width:320px;max-width:100%;height:auto;border:0;margin:0 auto 36px;" />
        <h1 style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:1.2;font-weight:800;color:#111111;">${esc(title)}</h1>
        <p style="margin:0 auto 22px;max-width:440px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#333333;">${intro}</p>
        ${extra}
        <p style="margin:36px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#8a8a8a;">Si no reconoces este mensaje, puedes ignorarlo.<br />soporte@matubyte.com · © ${year} Matubyte</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function codeEmail({ name, code }) {
  const who = esc(name || 'hola');
  const html = layout({
    title: 'Tu código de verificación',
    intro: `Hola <strong>${who}</strong>. Te escribimos para confirmar que este correo es tuyo. Copia el código de abajo y pégalo en la pantalla de verificación. Así podremos crear tu cuenta.`,
    extra: `
      <p style="margin:8px 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:34px;letter-spacing:10px;font-weight:800;color:#111111;">${esc(spaced(code))}</p>
      <p style="margin:0 auto;max-width:420px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#8a8a8a;">El código caduca en quince minutos. Si tú no pediste este mensaje, no hagas nada: nadie más puede usar tu cuenta con este correo.</p>
    `,
  });
  const text = `Hola ${name || ''}. Te escribimos en español para confirmar tu correo. Tu código de verificación es ${code}. Caduca en quince minutos. Si no lo pediste, ignora este mensaje.`;
  return { subject: 'Tu código de verificación', html, text };
}

function welcomeEmail({ name }) {
  const who = esc(name || 'hola');
  const href = `${publicBase()}/login`;
  const html = layout({
    title: 'Tu cuenta ya está lista',
    intro: `Hola <strong>${who}</strong>. Gracias por registrarte. Ya verificamos tu correo y tu cuenta quedó creada.`,
    extra: `
      <p style="margin:0 auto 28px;max-width:440px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#333333;">Entra cuando quieras para conversar con los modelos de <strong>Matubyte</strong>.</p>
      <a href="${esc(href)}" style="display:inline-block;background:#111111;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;letter-spacing:0.06em;text-decoration:none;padding:14px 28px;border-radius:8px;">ENTRAR AHORA</a>
    `,
  });
  const text = `Hola ${name || ''}. Tu cuenta ya está lista y este mensaje está en español. Entra cuando quieras: ${href}`;
  return { subject: 'Tu cuenta ya está lista', html, text };
}

function transport() {
  if (!config.mail.pass) {
    const err = new Error(
      'Falta la clave de Zoho. Agrégala en SMTP_PASS (soporte@matubyte.com).'
    );
    err.status = 503;
    throw err;
  }
  return nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.port === 465 ? true : config.mail.secure,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    dnsTimeout: 10000,
    auth: {
      user: config.mail.user,
      pass: config.mail.pass,
    },
    lookup(hostname, options, callback) {
      dns.lookup(hostname, { ...options, family: 4 }, callback);
    },
  });
}

function transientMailError(err) {
  const code = String(err?.code || '');
  return ['ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'ESOCKET', 'ECONNECTION'].includes(
    code
  );
}

export async function sendAppMail({ to, subject, html, text }) {
  return sendMail({ to, subject, html, text });
}

async function sendMail({ to, subject, html, text }) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await transport().sendMail({
        from: config.mail.from,
        to,
        subject,
        html,
        text,
        replyTo: 'soporte@matubyte.com',
        encoding: 'utf-8',
        headers: {
          'Content-Language': 'es-CO',
          'Accept-Language': 'es-CO, es',
        },
        attachments: bannerAttachments(),
      });
    } catch (err) {
      last = err;
      if (!transientMailError(err) || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    }
  }
  throw last;
}

export async function ensureEmailSchema() {
  const db = getDb();
  const statements = [
    `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false`,
    `CREATE TABLE IF NOT EXISTS email_otps (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      password_enc TEXT NOT NULL DEFAULT '',
      attempts INT NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  ];
  for (const sql of statements) {
    const { error } = await db.rpc(sql);
    if (error) {
      console.warn('[email] schema', error.message || error);
    }
  }
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function assertEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('El correo no es válido');
    err.status = 400;
    throw err;
  }
}

async function listOtps(email, purpose) {
  const db = getDb();
  const { data, error } = await db
    .from('email_otps')
    .select('id, email, purpose, code_hash, name, password_enc, attempts, expires_at, created_at')
    .eq('email', email)
    .eq('purpose', purpose)
    .limit(10);
  if (error) {
    const err = new Error(error.message || 'No se pudo leer el código');
    err.status = /does not exist|relation/i.test(err.message) ? 503 : 500;
    throw err;
  }
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return rows;
}

async function deletePurpose(email, purpose) {
  const db = getDb();
  const { error } = await db
    .from('email_otps')
    .eq('email', email)
    .eq('purpose', purpose)
    .delete();
  if (error) console.warn('[email] delete otp', error.message || error);
}

async function issueOtp({ email, purpose, name, password }) {
  const rows = await listOtps(email, purpose);
  const latest = rows[0];
  if (latest) {
    const age = Date.now() - new Date(latest.created_at).getTime();
    const alive = new Date(latest.expires_at).getTime() > Date.now();
    if (alive && age < RESEND_MS) {
      return { reused: true };
    }
  }

  const code = newCode();
  const db = getDb();
  await deletePurpose(email, purpose);
  const { error } = await db.from('email_otps').insert({
    id: newId(),
    email,
    purpose,
    code_hash: hashCode(email, purpose, code),
    name: name || '',
    password_enc: password ? encryptSecret(password) : '',
    attempts: 0,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    created_at: new Date().toISOString(),
  });
  if (error) {
    const err = new Error(error.message || 'No se pudo guardar el código');
    err.status = 500;
    throw err;
  }

  const letter = codeEmail({ name, code });
  try {
    await sendMail({ to: email, ...letter });
  } catch (err) {
    await deletePurpose(email, purpose);
    const wrapped = new Error(
      err.status === 503
        ? err.message
        : 'No pudimos enviar el correo. Inténtalo de nuevo en un momento.'
    );
    wrapped.status = err.status || 502;
    console.warn('[email] send', err?.message || err);
    throw wrapped;
  }
  return { reused: false };
}

async function takeOtp({ email, purpose, code }) {
  const digits = String(code || '').replace(/\D/g, '');
  if (digits.length !== 6) {
    const err = new Error('Escribe el código de 6 dígitos');
    err.status = 400;
    throw err;
  }
  const rows = await listOtps(email, purpose);
  const row = rows[0];
  if (!row) {
    const err = new Error('Pide un código nuevo');
    err.status = 400;
    throw err;
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await deletePurpose(email, purpose);
    const err = new Error('El código caducó. Pide otro.');
    err.status = 400;
    throw err;
  }
  if (!codesMatch(row.code_hash, hashCode(email, purpose, digits))) {
    const attempts = Number(row.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await deletePurpose(email, purpose);
      const err = new Error('Demasiados intentos. Pide un código nuevo.');
      err.status = 400;
      throw err;
    }
    const db = getDb();
    const { error } = await db
      .from('email_otps')
      .eq('id', row.id)
      .update({ attempts });
    if (error) console.warn('[email] attempts', error.message || error);
    const err = new Error('Ese código no coincide');
    err.status = 400;
    throw err;
  }
  return row;
}

async function emailTaken(email) {
  const db = getDb();
  const { data, error } = await db
    .from('profiles')
    .select('id')
    .eq('email', email)
    .limit(1);
  if (error) return false;
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.length > 0;
}

export async function requestSignupCode({ email, password, name }) {
  const clean = cleanEmail(email);
  assertEmail(clean);
  if (String(password || '').length < 8) {
    const err = new Error('La contraseña debe tener al menos 8 caracteres');
    err.status = 400;
    throw err;
  }
  if (await emailTaken(clean)) {
    const err = new Error('Ese correo ya tiene cuenta. Inicia sesión para verificarla.');
    err.status = 409;
    throw err;
  }
  const display = String(name || clean.split('@')[0]).trim().slice(0, 80);
  return issueOtp({
    email: clean,
    purpose: 'signup',
    name: display,
    password,
  });
}

export async function confirmSignupCode({ email, code }, deps) {
  const clean = cleanEmail(email);
  assertEmail(clean);
  const row = await takeOtp({ email: clean, purpose: 'signup', code });
  const password = decryptSecret(row.password_enc);
  const name = row.name || clean.split('@')[0];

  let user;
  let token;
  try {
    ({ user, token } = await matudbRegister({ email: clean, password, name }));
  } catch (err) {
    const msg = String(err?.message || '');
    if (!/exist|already|registrad|duplicate/i.test(msg)) throw err;
    ({ user, token } = await matudbLogin({ email: clean, password }));
  }
  if (!user) {
    const err = new Error('No se pudo crear la cuenta');
    err.status = 500;
    throw err;
  }
  const verified = await deps.verifyAccessToken(token);
  if (!verified?.id) {
    const err = new Error('No se pudo abrir la sesión de la cuenta nueva');
    err.status = 500;
    throw err;
  }
  verified.name = name || verified.name;
  verified.email = verified.email || clean;
  const { profile } = await deps.ensureWorkspace(verified);

  const db = getDb();
  const { error: markErr } = await db
    .from('profiles')
    .eq('id', profile.id)
    .update({ email_verified: true });
  if (markErr) console.warn('[email] verify flag', markErr.message || markErr);

  await deletePurpose(clean, 'signup');

  try {
    const letter = welcomeEmail({ name: profile.display_name || name });
    await sendMail({ to: clean, ...letter });
  } catch (err) {
    console.warn('[email] welcome', err?.message || err);
  }

  return {
    token,
    user: {
      id: profile.id,
      email: profile.email || clean,
      name: profile.display_name || name,
      email_verified: true,
    },
  };
}

export async function sendAccountCode({ email, name }) {
  const clean = cleanEmail(email);
  assertEmail(clean);
  return issueOtp({
    email: clean,
    purpose: 'verify',
    name: name || clean.split('@')[0],
    password: '',
  });
}

export async function confirmAccountCode({ userId, email, code }) {
  const clean = cleanEmail(email);
  assertEmail(clean);
  await takeOtp({ email: clean, purpose: 'verify', code });
  const db = getDb();
  const { error } = await db
    .from('profiles')
    .eq('id', userId)
    .update({ email_verified: true });
  if (error) {
    const err = new Error(error.message || 'No se pudo marcar el correo como verificado');
    err.status = 500;
    throw err;
  }
  await deletePurpose(clean, 'verify');
  return { ok: true, email_verified: true };
}

function sendError(res, err) {
  const status = err.status || 400;
  res.status(status).json({ error: { message: err.message || 'No se pudo completar' } });
}

export function registerEmailRoutes(app, deps) {
  app.post('/api/auth/register/code', async (req, res) => {
    try {
      const result = await requestSignupCode({
        email: req.body?.email,
        password: req.body?.password,
        name: req.body?.name,
      });
      res.json({ ok: true, sent: !result.reused });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post('/api/auth/register/confirm', async (req, res) => {
    try {
      const result = await confirmSignupCode(
        { email: req.body?.email, code: req.body?.code },
        deps
      );
      res.status(201).json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post('/api/auth/verify/send', deps.authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await deps.ensureWorkspace(req.user);
      if (profile.email_verified === true) {
        return res.json({ ok: true, already: true });
      }
      const result = await sendAccountCode({
        email: profile.email,
        name: profile.display_name,
      });
      res.json({ ok: true, sent: !result.reused, email: profile.email });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post('/api/auth/verify/confirm', deps.authMiddleware(true), async (req, res) => {
    try {
      const { profile } = await deps.ensureWorkspace(req.user);
      if (profile.email_verified === true) {
        return res.json({ ok: true, email_verified: true });
      }
      const result = await confirmAccountCode({
        userId: profile.id,
        email: profile.email,
        code: req.body?.code,
      });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });
}
