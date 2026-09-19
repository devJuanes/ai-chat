# **@devjuanes/matuclient**

![TypeScript icon, indicating that this package has built-in type declarations](https://static-production.npmjs.com/4a2a680dfcadf231172b78b1d3beb975.svg "This package contains built-in TypeScript declarations")

2.3.0 • Public • Published a month ago

- 

# **@devjuanes/matuclient**

![npm version](https://camo.githubusercontent.com/4a396fc41c25524640f426ffb85cc302f9e7f36b020636d1fdd994015d4f57fb/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f762f406465766a75616e65732f6d617475636c69656e74) ![MIT License](https://camo.githubusercontent.com/784362b26e4b3546254f1893e778ba64616e362bd6ac791991d2c9e880a3a64e/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f4c6963656e73652d4d49542d677265656e2e737667) ![TypeScript](https://camo.githubusercontent.com/45b829539bf0317a1c5d2bee7b463a38642a4cd5a8491bc779b68fadab1b1848/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f547970655363726970742d352e372d626c75652e737667) ![Node.js](https://camo.githubusercontent.com/390bc69521afbba73adb758a91a3c03c968c1143b902027a82c3f102c96ef6e6/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f4e6f64652e6a732d31382532422d627269676874677265656e2e737667)

> **Official JavaScript/TypeScript client for MatuDB** — A self-hosted database platform with real-time, authentication, and storage. Developed by **DevJuanes** (Juan Esteban Landazuri) from Cali, Colombia.

## **About MatuDB**

**MatuDB** is a self-hosted database platform created by **Juan Esteban Landazuri** (DevJuanes), a senior full-stack developer from Cali, Colombia with 15+ years of experience. It provides:

- **Full data ownership** — Your database stays on your servers
- **PostgreSQL power** — Full relational database capabilities
- **Real-time updates** — WebSocket-based live subscriptions
- **Authentication** — JWT-based auth system
- **File storage** — Upload, download, and manage files

### **Built by DevJuanes**

- **Website**: [https://devjuanes.com](https://devjuanes.com/)
- **GitHub**: [https://github.com/DevJuanes](https://github.com/DevJuanes)
- **NPM**: [@devjuanes/matuclient](https://www.npmjs.com/package/@devjuanes/matuclient)

## **Installation**

```
npm install @devjuanes/matuclient
```

Or use locally (within the MatuDB monorepo):

```
npm install ../matu-db-api/packages/matuclient
```

## **Features**

- **PostgreSQL Database** — Full relational database power
- **Multi-schema projects** — Query `main`, `shop`, or any schema slug via config or `db.schema()`
- **Real-time Subscriptions** — WebSocket-based live updates via Socket.io
- **Authentication** — JWT-based auth system
- **File Storage** — Upload, download, and manage files
- **Email templates** — `db.templates` for programmed emails
- **TypeScript Support** — Full type definitions included
- **Supabase-compatible API** — Familiar patterns for developers

## **Quick Start**

```
import { createClient } from '@devjuanes/matuclient';

const db = createClient({
  url: 'https://api.matudb.dev', // or your MatuDB API URL
  projectId: 'my-project',
  apiKey: 'anon_xxxx',
});

// Query data (default / main schema)
const { data, error } = await db.from('users').select('*').eq('active', true);
```

## **Configuration**

### **Automatic Configuration (Environment Variables)**

```
MATUDB_URL=https://api.matudb.dev
MATUDB_PROJECT_ID=my-project
MATUDB_API_KEY=anon_xxxx...
MATUDB_SCHEMA=main
MATUDB_USE_SUPABASE=false

# Vite / frontend
VITE_MATUDB_URL=...
VITE_MATUDB_API_KEY=...
VITE_MATUDB_SCHEMA=shop
```

### **Manual Configuration**

```
import { createClient } from '@devjuanes/matuclient';

const db = createClient({
  url: 'https://api.matudb.dev',
  projectId: 'my-project',
  apiKey: 'anon_xxxx',
  schema: 'main', // optional project schema slug
  useSupabase: false,
});
```

## **Schemas (multi-tenant / multi-app data)**

In the MatuDB console each **schema** has a slug (e.g. `main`, `shop`, `ops`). The client sends that slug as:

- Header: `X-MatuDB-Schema`
- Query: `?schema=shop`

so reads, writes and raw SQL hit the correct PostgreSQL schema.

```
const db = createClient({ url, projectId, apiKey });

// Option A — default schema for the whole client
const shop = createClient({ url, projectId, apiKey, schema: 'shop' });
await shop.from('products').select('*');

// Option B — scoped client from an existing instance
const ops = db.schema('ops');
await ops.from('tickets').insert({ title: 'New issue' });
await ops.rpc('SELECT count(*) FROM tickets');
```

## **API Reference**

### `db.schema(slug)` **— Schema-scoped client**

```
const shopDb = db.schema('shop');
const { data } = await shopDb.from('orders').select('*').limit(20);
```

### `db.from(table)` **— Query Builder**

```
// SELECT with filters
const { data, error } = await db
  .from('users')
  .select('id, name, email')
  .eq('active', true)
  .order('created_at', { ascending: false })
  .limit(10);

// Filter operators
.eq('col', value)       // =
.neq('col', value)      // !=
.gt('col', value)       // >
.gte('col', value)      // >=
.lt('col', value)       // <
.lte('col', value)      // <=
.like('col', '%patt%')  // LIKE
.ilike('col', '%patt%') // ILIKE (case-insensitive)
.in('col', [1, 2, 3])   // IN (...)
.is('col', null)        // IS NULL / IS TRUE / IS FALSE

// Single row
const { data: user } = await db.from('users').select('*').eq('id', userId).single();

// INSERT
const { data, error } = await db.from('products').insert({ name: 'Widget', price: 9.99 });

// INSERT multiple
const { data } = await db.from('products').insert([{ name: 'A' }, { name: 'B' }]);

// UPDATE
const { data } = await db.from('users').update({ name: 'Alice' }).eq('id', userId);

// DELETE
const { data } = await db.from('orders').delete().eq('id', orderId);
```

### `db.auth` **— Authentication**

```
// Sign up
const { data, error } = await db.auth.signUp({ email, password });

// Sign in
const { data, error } = await db.auth.signInWithPassword({ email, password });
// data = { user, session: { access_token, expires_at, user } }

// Sign out
await db.auth.signOut();

// Get current session
const { data: { session } } = await db.auth.getSession();

// Get current user
const { data: { user } } = await db.auth.getUser();

// Listen for auth changes
const { data: { subscription } } = db.auth.onAuthStateChange((event, session) => {
  console.log(event); // 'SIGNED_IN' | 'SIGNED_OUT'
});
// Cleanup:
subscription.unsubscribe();
```

### `db.storage` **— File Storage**

```
// Upload
const { data, error } = await db.storage.upload('avatar.png', file);

// Get public URL
const { data: { publicUrl } } = db.storage.getPublicUrl('avatar.png');

// List files
const { data: files } = await db.storage.list();

// Download
const { data: blob } = await db.storage.download('report.pdf');

// Delete
await db.storage.remove(['old-file.png', 'another.pdf']);
```

### `db.channel()` **— Realtime**

```
// Supabase-compatible style
const channel = db
  .channel('public:users')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, payload => {
    console.log('Change:', payload);
  })
  .subscribe();

// Short style
db.channel('orders')
  .on('INSERT', payload => console.log('New order:', payload.data))
  .on('DELETE', payload => console.log('Deleted:', payload.data))
  .subscribe();

// Cleanup
db.removeChannel(channel);
db.removeAllChannels();
```

### `db.rpc()` **— Raw SQL**

```
const { data, error } = await db.rpc('SELECT * FROM users WHERE created_at > NOW() - INTERVAL \'7 days\'');
```

## **Related Packages**

- **[matu-db-api](https://github.com/DevJuanes/matu-db-api)** — The MatuDB backend server
- **[matudeploy](https://github.com/DevJuanes/matu-db-api/tree/main/packages/matudeploy)** — Deployment tools

## **License**

MIT License — Developed with ❤️ in Cali, Colombia by **[DevJuanes](https://devjuanes.com/)**