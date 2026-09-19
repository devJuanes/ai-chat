# Matu AI SaaS — Chat

Chat graphite-on-paper con autenticación MatuDB, espacios de trabajo, límites por plan y tres modelos públicos (**Matu**, **VO0**, **VO5**) afinados con system prompts en `docs/models/*.md`.

Estilos con **Tailwind CSS v4**. Toda la interfaz está en español.

## Setup

1. Copia `.env.example` → `.env` y completa MatuDB + `UPSTREAM_API_KEY`.
2. Ejecuta `docs/schema.sql` en la consola SQL de MatuDB.
3. `npm install`
4. `npm run dev` — API en `:8787`, Vite en `:5173` (proxy `/api`).

## Rutas

| Ruta | Uso |
|------|-----|
| `/c/new` | Chat nuevo |
| `/c/:id` | Conversación |
| `/login` | Iniciar sesión |
| `/register` | Crear cuenta |

## Modelos

Edita los prompts en `docs/models/` — esa es la capa de afinación. La UI pública nunca revela el proveedor upstream.
