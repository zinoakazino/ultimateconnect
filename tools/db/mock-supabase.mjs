// A small local look-alike of Supabase (sign-in + data API + real-time), backed by a REAL Postgres engine
// (PGlite) running the real supabase/*.sql files. It lets the whole app be tried and tested on this computer
// without internet and without touching the real project: same tables, same row-level security rules.
//
//   cd tools/db && npm install && npm run mock
//     -> API  http://127.0.0.1:54321   (the app's EXPO_PUBLIC_SUPABASE_URL)
//     -> app  http://127.0.0.1:8090    (serves ../../dist, built with `npm run build:web`) — optional
//
// It understands the subset of the Supabase protocol the app uses (see src/lib/api.ts). It is a test tool,
// not a replacement for Supabase: data lives in memory and is lost when it stops.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createDb, signUp } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const API_PORT = Number(process.env.MOCK_API_PORT || 54321);
const APP_PORT = Number(process.env.MOCK_APP_PORT || 8090);
const DIST = path.join(here, '..', '..', 'dist');
const SECRET = 'mock-jwt-secret-for-local-tests-only-0123456789';
const ISS = `http://127.0.0.1:${API_PORT}/auth/v1`;

/* ------------------------------------------------------------------ tokens */
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function sign(payload) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verify(token) {
  const [h, b, s] = String(token || '').split('.');
  if (!h || !b || !s) return null;
  const expect = crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url');
  if (expect !== s) return null;
  try {
    const p = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (p.exp && p.exp * 1000 < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}
export const ANON_KEY = sign({ iss: 'supabase-demo', role: 'anon', exp: 4102444800 });

/* ---------------------------------------------------------------- passwords */
const hash = (pw) => {
  const salt = crypto.randomBytes(8).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
};
const checkPw = (pw, stored) => {
  const [salt, h] = String(stored || '').split(':');
  return Boolean(salt) && crypto.scryptSync(pw, salt, 32).toString('hex') === h;
};

/* ------------------------------------------------------------------ the data */
const pg = await createDb({ seed: true });
const refreshTokens = new Map(); // refresh token -> user id

const lit = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;

async function asRole(claims, fn) {
  return pg.transaction(async (tx) => {
    if (claims?.sub) {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    } else {
      await tx.exec('set local role anon');
      await tx.query("select set_config('request.jwt.claims', '', true)");
    }
    return fn(tx);
  });
}

/* ---------------------------------------------------------------- PostgREST */
function parseFilters(params) {
  const where = [];
  const reserved = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
  for (const [key, value] of params.entries()) {
    if (reserved.has(key)) continue;
    const m = /^(not\.)?([a-z]+)\.(.*)$/s.exec(value);
    if (!m) continue;
    const [, neg, op, rest] = m;
    const col = ident(key);
    let cond;
    switch (op) {
      case 'eq': cond = `${col} = ${lit(rest)}`; break;
      case 'neq': cond = `${col} <> ${lit(rest)}`; break;
      case 'gt': cond = `${col} > ${lit(rest)}`; break;
      case 'gte': cond = `${col} >= ${lit(rest)}`; break;
      case 'lt': cond = `${col} < ${lit(rest)}`; break;
      case 'lte': cond = `${col} <= ${lit(rest)}`; break;
      case 'like': cond = `${col} like ${lit(rest.replace(/\*/g, '%'))}`; break;
      case 'ilike': cond = `${col} ilike ${lit(rest.replace(/\*/g, '%'))}`; break;
      case 'is': cond = `${col} is ${rest === 'null' ? 'null' : rest === 'true' ? 'true' : rest === 'false' ? 'false' : 'unknown'}`; break;
      case 'in': {
        const items = rest.replace(/^\(|\)$/g, '').split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
        cond = `${col} in (${items.map(lit).join(', ')})`;
        break;
      }
      default: throw Object.assign(new Error(`unsupported filter ${op}`), { code: 'PGRST100', status: 400 });
    }
    where.push(neg ? `not (${cond})` : cond);
  }
  return where.length ? ` where ${where.join(' and ')}` : '';
}

function parseOrder(params) {
  const o = params.get('order');
  if (!o) return '';
  const parts = o.split(',').map((p) => {
    const [col, ...mods] = p.split('.');
    return `${ident(col)} ${mods.includes('desc') ? 'desc' : 'asc'}${mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : ''}`;
  });
  return ` order by ${parts.join(', ')}`;
}

const STATUS = (code, anon) => {
  if (code === '42501') return anon ? 401 : 403;
  if (/^23/.test(code)) return 409;
  if (code === '42P01') return 404;
  return 400;
};

async function rest(req, res, url, body, claims) {
  const anon = !claims?.sub;
  const prefer = String(req.headers.prefer || '');
  const wantsRows = /return=representation/.test(prefer);
  const wantsObject = /vnd\.pgrst\.object\+json/.test(String(req.headers.accept || ''));
  const parts = url.pathname.replace(/^\/rest\/v1\//, '').split('/');

  try {
    // ---- RPC
    if (parts[0] === 'rpc') {
      const fn = parts[1];
      const args = body && typeof body === 'object' ? body : {};
      const named = Object.entries(args).map(([k, v]) => `${ident(k)} => ${lit(v)}`).join(', ');
      const r = await asRole(claims, async (tx) => {
        const kind = (await tx.query("select prorettype::regtype::text t from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace limit 1", [fn])).rows[0];
        if (!kind) throw Object.assign(new Error(`Could not find the function public.${fn}`), { code: 'PGRST202' });
        if (kind.t === 'void') {
          await tx.query(`select public.${ident(fn)}(${named})`);
          return { void: true };
        }
        const out = await tx.query(`select to_json(public.${ident(fn)}(${named})) as r`);
        return { void: false, value: out.rows[0].r };
      });
      if (r.void) return send(res, 204);
      return send(res, 200, r.value);
    }

    const table = `public.${ident(parts[0])}`;
    const method = req.method;

    if (method === 'GET' || method === 'HEAD') {
      const select = url.searchParams.get('select') || '*';
      const cols = select === '*' ? '*' : select.split(',').map((c) => ident(c.trim())).join(', ');
      let sql = `select ${cols} from ${table}${parseFilters(url.searchParams)}${parseOrder(url.searchParams)}`;
      if (url.searchParams.get('limit')) sql += ` limit ${Number(url.searchParams.get('limit'))}`;
      if (url.searchParams.get('offset')) sql += ` offset ${Number(url.searchParams.get('offset'))}`;
      const rows = (await asRole(claims, (tx) => tx.query(`select coalesce(json_agg(t), '[]'::json) as rows from (${sql}) t`))).rows[0].rows;
      if (wantsObject) {
        if (rows.length !== 1) {
          return send(res, 406, { code: 'PGRST116', details: `The result contains ${rows.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' });
        }
        return send(res, 200, rows[0]);
      }
      return send(res, 200, rows);
    }

    if (method === 'POST') {
      const rowsIn = Array.isArray(body) ? body : [body];
      const keys = [...new Set(rowsIn.flatMap((r) => Object.keys(r)))];
      const colList = keys.map(ident).join(', ');
      const conflict = url.searchParams.get('on_conflict');
      let onConflict = '';
      if (/resolution=merge-duplicates/.test(prefer)) {
        const target = (conflict || '').split(',').filter(Boolean).map(ident).join(', ');
        const sets = keys.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(', ');
        onConflict = ` on conflict (${target}) do update set ${sets}`;
      } else if (/resolution=ignore-duplicates/.test(prefer)) {
        onConflict = ' on conflict do nothing';
      }
      const sql = `insert into ${table} (${colList}) select ${colList} from json_populate_recordset(null::${table}, ${lit(JSON.stringify(rowsIn))}::json)${onConflict}${wantsRows ? ' returning *' : ''}`;
      const r = await asRole(claims, (tx) => tx.query(sql));
      emit(parts[0], onConflictWasUpdate(prefer) ? 'UPDATE' : 'INSERT');
      if (wantsRows) return send(res, 201, wantsObject ? r.rows[0] : r.rows);
      return send(res, 201);
    }

    if (method === 'PATCH') {
      const keys = Object.keys(body || {});
      const payload = `${lit(JSON.stringify(body))}::json`;
      const sets = keys.map((k) => `${ident(k)} = (json_populate_record(null::${table}, ${payload})).${ident(k)}`).join(', ');
      const sql = `update ${table} set ${sets}${parseFilters(url.searchParams)}${wantsRows ? ' returning *' : ''}`;
      const r = await asRole(claims, (tx) => tx.query(sql));
      if (r.affectedRows) emit(parts[0], 'UPDATE');
      if (wantsRows) return send(res, 200, r.rows);
      return send(res, 204);
    }

    if (method === 'DELETE') {
      const sql = `delete from ${table}${parseFilters(url.searchParams)}${wantsRows ? ' returning *' : ''}`;
      const r = await asRole(claims, (tx) => tx.query(sql));
      if (r.affectedRows) emit(parts[0], 'DELETE');
      if (wantsRows) return send(res, 200, r.rows);
      return send(res, 204);
    }
    return send(res, 405, { message: 'method not allowed' });
  } catch (e) {
    const code = e.code || e.message?.match(/^[0-9A-Z]{5}$/)?.[0] || 'PGRST000';
    const status = e.status || STATUS(String(e.code || ''), anon);
    return send(res, status, { code: String(code), details: e.detail ?? null, hint: e.hint ?? null, message: e.message });
  }
}
const onConflictWasUpdate = (prefer) => /resolution=merge-duplicates/.test(prefer);

/* --------------------------------------------------------------------- auth */
const userJson = (u) => ({
  id: u.id,
  aud: 'authenticated',
  role: 'authenticated',
  email: u.email,
  email_confirmed_at: u.created_at,
  phone: '',
  confirmed_at: u.created_at,
  last_sign_in_at: u.last_sign_in_at || u.created_at,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: u.raw_user_meta_data || {},
  identities: [],
  created_at: u.created_at,
  updated_at: u.created_at,
});

function sessionFor(u) {
  const now = Math.floor(Date.now() / 1000);
  const access = sign({
    aud: 'authenticated', exp: now + 3600, iat: now, iss: ISS, sub: u.id, email: u.email, phone: '',
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.raw_user_meta_data || {},
    role: 'authenticated', aal: 'aal1', amr: [{ method: 'password', timestamp: now }], session_id: crypto.randomUUID(), is_anonymous: false,
  });
  const refresh = crypto.randomBytes(8).toString('hex');
  refreshTokens.set(refresh, u.id);
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: refresh, user: userJson(u) };
}

const authErr = (res, status, error_code, msg) => send(res, status, { code: status, error_code, msg });

async function auth(req, res, url, body, claims) {
  const route = url.pathname.replace(/^\/auth\/v1\//, '');
  const byId = async (id) => (await pg.query('select * from auth.users where id = $1', [id])).rows[0];

  // what the project's settings page says to the outside (tools/db/live-check.mjs reads it)
  if (route === 'settings' && req.method === 'GET') {
    return send(res, 200, { external: { email: true, phone: false }, disable_signup: false, mailer_autoconfirm: true, phone_autoconfirm: false });
  }

  if (route === 'signup' && req.method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return authErr(res, 422, 'email_address_invalid', `Email address "${email}" is invalid`);
    if (String(body.password || '').length < 6) return authErr(res, 422, 'weak_password', 'Password should be at least 6 characters.');
    if ((await pg.query('select 1 from auth.users where email = $1', [email])).rows.length) return authErr(res, 422, 'user_already_exists', 'User already registered');
    try {
      const id = crypto.randomUUID();
      await pg.query('insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, $2, $3, $4::jsonb)', [id, email, hash(body.password), JSON.stringify(body.data || {})]);
      emit('profiles', 'INSERT');
      return send(res, 200, sessionFor(await byId(id)));
    } catch (e) {
      return authErr(res, 500, 'unexpected_failure', 'Database error saving new user');
    }
  }

  if (route === 'token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const u = (await pg.query('select * from auth.users where email = $1', [String(body.email || '').trim().toLowerCase()])).rows[0];
      if (!u || !checkPw(body.password || '', u.encrypted_password)) return authErr(res, 400, 'invalid_credentials', 'Invalid login credentials');
      await pg.query('update auth.users set last_sign_in_at = now() where id = $1', [u.id]);
      return send(res, 200, sessionFor(await byId(u.id)));
    }
    if (grant === 'refresh_token') {
      const id = refreshTokens.get(body.refresh_token);
      if (!id) return authErr(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      refreshTokens.delete(body.refresh_token);
      return send(res, 200, sessionFor(await byId(id)));
    }
  }

  if (route === 'user') {
    if (!claims?.sub) return authErr(res, 401, 'bad_jwt', 'invalid JWT');
    const u = await byId(claims.sub);
    if (!u) return authErr(res, 403, 'user_not_found', 'User from sub claim in JWT does not exist');
    if (req.method === 'GET') return send(res, 200, userJson(u));
    if (req.method === 'PUT') {
      if (body.password) {
        if (String(body.password).length < 6) return authErr(res, 422, 'weak_password', 'Password should be at least 6 characters.');
        await pg.query('update auth.users set encrypted_password = $2 where id = $1', [u.id, hash(body.password)]);
      }
      return send(res, 200, userJson(await byId(u.id)));
    }
  }
  if (route === 'logout') return send(res, 204);
  if (route === 'recover') return send(res, 200, {});
  if (route === 'settings') return send(res, 200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: true });
  return authErr(res, 404, 'not_found', `no route ${route}`);
}

/* ---------------------------------------------------------------- real-time */
const wss = new WebSocketServer({ noServer: true });
const channels = new Set(); // { ws, topic, subs: [{id, table}] }
let subSeq = 1000;
function emit(table, type) {
  for (const ch of channels) {
    const hit = ch.subs.filter((s) => s.table === table);
    if (!hit.length || ch.ws.readyState !== 1) continue;
    ch.ws.send(wire(ch.ws.v2, {
      topic: ch.topic, event: 'postgres_changes', ref: null, join_ref: ch.joinRef,
      payload: { ids: hit.map((s) => s.id), data: { schema: 'public', table, commit_timestamp: new Date().toISOString(), type, record: {}, old_record: {}, columns: [], errors: null } },
    }));
  }
}
const wire = (v2, m) => JSON.stringify(v2 ? [m.join_ref ?? null, m.ref ?? null, m.topic, m.event, m.payload] : m);
wss.on('connection', (ws, req) => {
  const mine = new Set();
  const v2 = /vsn=2.0.0/.test(req.url || '');
  ws.v2 = v2;
  ws.on('message', (raw, isBinary) => {
    if (isBinary) return;
    let m;
    try {
      const parsed = JSON.parse(String(raw));
      m = Array.isArray(parsed) ? { join_ref: parsed[0], ref: parsed[1], topic: parsed[2], event: parsed[3], payload: parsed[4] } : parsed;
    } catch { return; }
    const reply = (payload) => ws.send(wire(v2, { topic: m.topic, event: 'phx_reply', payload, ref: m.ref, join_ref: m.join_ref }));
    if (m.event === 'heartbeat') return reply({ status: 'ok', response: {} });
    if (m.event === 'phx_join') {
      const wanted = m.payload?.config?.postgres_changes || [];
      const subs = wanted.map((w) => ({ id: ++subSeq, table: w.table, event: w.event, schema: w.schema }));
      const ch = { ws, topic: m.topic, subs, joinRef: m.join_ref };
      channels.add(ch);
      mine.add(ch);
      reply({ status: 'ok', response: { postgres_changes: subs.map((s) => ({ id: s.id, event: s.event, schema: s.schema, table: s.table })) } });
      ws.send(wire(v2, { topic: m.topic, event: 'system', ref: null, join_ref: m.join_ref, payload: { message: 'Subscribed to PostgreSQL', status: 'ok', extension: 'postgres_changes', channel: m.topic.replace('realtime:', '') } }));
      return;
    }
    if (m.event === 'phx_leave') {
      for (const ch of mine) if (ch.topic === m.topic) channels.delete(ch);
      return reply({ status: 'ok', response: {} });
    }
    if (m.event === 'access_token') return reply({ status: 'ok', response: {} });
  });
  ws.on('close', () => mine.forEach((c) => channels.delete(c)));
});

/* ------------------------------------------------------------------- server */
function send(res, status, json) {
  const body = json === undefined ? '' : JSON.stringify(json);
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(body);
}
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer, accept, accept-profile, content-profile, range, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
  'Access-Control-Expose-Headers': 'content-range, content-profile',
};

const api = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  const url = new URL(req.url, `http://127.0.0.1:${API_PORT}`);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body = null;
  const text = Buffer.concat(chunks).toString();
  if (text) { try { body = JSON.parse(text); } catch { body = null; } }
  const bearer = String(req.headers.authorization || '').replace(/^Bearer /i, '');
  const claims = verify(bearer);
  const user = claims && claims.role === 'authenticated' ? claims : null;
  if (process.env.MOCK_LOG) console.log(req.method, url.pathname + url.search, user ? user.email : 'anon');
  try {
    if (url.pathname.startsWith('/rest/v1/')) return await rest(req, res, url, body, user);
    if (url.pathname.startsWith('/auth/v1/')) return await auth(req, res, url, body, user);
    return send(res, 404, { message: 'not found' });
  } catch (e) {
    console.error('mock error:', e);
    return send(res, 500, { message: String(e.message) });
  }
});
api.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/realtime/v1/websocket')) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const app = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html'); // single-page app
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('run npm run build:web first'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

/* --------------------------------------------------------------- demo people */
const codes = Object.fromEntries((await pg.query('select key, value from public.config')).rows.map((r) => [r.key, r.value]));
const people = [
  ['sofia@uc.test', 'Sofia', 'staffpass123', codes.staff_code],
  ['yazid@uc.test', 'Yazid', 'staffpass123', codes.staff_code],
  ['amina@uc.test', 'Amina', 'aminapass123', codes.invite_code],
  ['karim@uc.test', 'Karim', 'aminapass123', codes.invite_code],
];
if (!process.env.MOCK_EMPTY) {
  for (const [email, name, password, code] of people) {
    const id = await signUp(pg, { email, name, phone: '0555 00 11 22', code });
    await pg.query('update auth.users set encrypted_password = $2 where id = $1', [id, hash(password)]);
  }
  await pg.query("update public.profiles set verified = true where email = 'amina@uc.test'");
}

api.listen(API_PORT, '127.0.0.1', () => {
  console.log(`Supabase look-alike on http://127.0.0.1:${API_PORT}`);
  console.log(`  EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:${API_PORT}`);
  console.log(`  EXPO_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}`);
  console.log(`  consultants code: ${codes.invite_code}    staff code: ${codes.staff_code}`);
  console.log('  participants list: the 21 prepared names appear at sign-up once the consultants code is typed (pick one: name, group and flights come with it)');
  console.log('  test accounts: sofia@uc.test / yazid@uc.test (staffpass123), amina@uc.test / karim@uc.test (aminapass123)');
});
app.listen(APP_PORT, '127.0.0.1', () => console.log(`  app (from ../../dist) on http://127.0.0.1:${APP_PORT}`));
