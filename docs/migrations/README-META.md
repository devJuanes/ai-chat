# Meta bots (WhatsApp · Messenger · Instagram)

## 1. Base de datos

Ejecuta en la consola SQL de MatuDB:

```text
docs/migrations/meta-bots.sql
```

## 2. Variables de entorno

Copia desde `.env.example` y rellena:

| Variable | Uso |
|----------|-----|
| `META_APP_ID` | ID de la app en Meta Developers |
| `META_APP_SECRET` | App Secret |
| `META_VERIFY_TOKEN` | Token que pones igual en el webhook |
| `META_API_VERSION` | Ej. `v21.0` |
| `META_EMBEDDED_SIGNUP_CONFIG_ID` | Config ID de WhatsApp Embedded Signup |
| `META_TOKEN_ENCRYPTION_KEY` | 64 hex o passphrase (cifra tokens en DB) |
| `PUBLIC_APP_URL` | URL pública HTTPS, ej. `https://ai.matubyte.com` |

Generar clave:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Meta App

1. Crea una app **Business** en [developers.facebook.com](https://developers.facebook.com).
2. Añade productos: **Messenger**, **Instagram**, **WhatsApp**.
3. Valid OAuth Redirect URI:
   - `{PUBLIC_APP_URL}/api/meta/oauth/callback`
4. Webhook URL:
   - `{PUBLIC_APP_URL}/api/meta/webhook`
   - Verify token = valor de `META_VERIFY_TOKEN`
5. Suscribe campos:
   - Page: `messages`, `messaging_postbacks`
   - Instagram: `messages`
   - WhatsApp: `messages`

### Permisos (App Review)

- `pages_show_list`
- `pages_messaging`
- `pages_manage_metadata`
- `instagram_basic`
- `instagram_manage_messages`
- `business_management`
- `whatsapp_business_management`
- `whatsapp_business_messaging`

En modo Development solo pueden escribirte testers de la app.

## 4. Flujo en Matu AI

1. Usuario entra a **Agentes** (`/bots`).
2. **Conectar Facebook / Instagram** → OAuth → se guardan Pages + IG.
3. **WhatsApp Embedded Signup** → code → WABA + phone number id.
4. Crea un agente (objetivo, instrucciones, contexto) y asigna canales.
5. Mensajes entrantes → webhook → agente → Graph API reply.
6. Equipo revisa en **Inbox** (`/inbox`); puede tomar control / reanudar bot.

## 5. Health check

`GET /api/health` incluye `metaConfigured: true|false`.

## 7. Leads / formularios (v2)

Ejecuta también:

```text
docs/migrations/meta-bots-v2-leads.sql
```

En **Agentes**:
- Pon **nombre del agente** + **nombre de la empresa** (no el correo).
- Añade productos/servicios y contexto.
- Crea un **formulario** (nombre, teléfono, email…) y asígnalo al agente.

Identidad en inbox:
- WhatsApp → teléfono (+ perfil si existe)
- Instagram → @username de Meta
- Facebook → first_name de Meta

## 8. nginx

Asegura el bloque `location /api/meta/webhook` de
`deploy/nginx-ai.matubyte.com.conf` y recarga nginx.
