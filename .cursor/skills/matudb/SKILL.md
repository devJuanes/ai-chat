---
name: matudb
description: >-
  Escribe y lee MatuDB con @devjuanes/matuclient. Úsala en cuanto haya insert,
  update, delete o select contra getDb(), db.from o tablas de MatuDB.
---

# MatuDB en este proyecto

El cliente es `@devjuanes/matuclient`. El filtro va **antes** de escribir.

```js
const { data, error } = await db.from('tabla').insert({ id, nombre });

const { error: updErr } = await db
  .from('tabla')
  .eq('id', id)
  .update({ nombre: 'nuevo', updated_at: new Date().toISOString() });

await db.from('tabla').eq('id', id).delete();

const { data: rows, error: selErr } = await db
  .from('tabla')
  .select('id, nombre')
  .eq('org_id', orgId)
  .limit(20);
```

`db.from(tabla).update(payload).eq('id', id)` lanza `eq is not a function`. No lo uses.

Inserta el `id` tú con `newId()` de `server/db.js`. Revisa `error` en cada llamada. Una fila duplicada en un UNIQUE llega como error: no reintentes el insert; lee la fila y actualízala con `.eq().update()`.
