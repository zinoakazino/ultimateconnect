// Runs the real supabase/*.sql files on a real Postgres engine (PGlite, Postgres in WebAssembly).
// Supabase itself provides the roles, the `auth` schema and `auth.uid()`: bootstrap() makes the same
// ones here, so the schema is exercised exactly as it will be on Supabase (roles + row-level security).
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const sqlFile = (name) => fs.readFileSync(path.join(here, '..', '..', 'supabase', name), 'utf8');

const BOOTSTRAP = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')
  )::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  )
$$;
create publication supabase_realtime;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

-- A Supabase project created since 30 May 2026 does NOT give these roles access to new tables, sequences
-- or functions by itself (setting "Automatically expose new tables and functions" is off): the schema must
-- grant what the API needs. So no default privileges here, and the built-in "anyone may execute a new
-- function" default is removed too (the strictest reading of that setting): a missing grant fails the tests.
alter default privileges revoke execute on functions from public;
`;

/** A fresh Supabase-like database. `schema: false` stops before 01-schema.sql (to test what the schema refuses). */
export async function createDb({ seed = false, schema = true } = {}) {
  const pg = new PGlite();
  await pg.exec(BOOTSTRAP);
  if (!schema) return pg;
  await pg.exec(sqlFile('01-schema.sql'));
  if (seed) await pg.exec(sqlFile('02-seed.sql'));
  return pg;
}

/**
 * Runs one statement the way PostgREST does: inside its own transaction, with the database role
 * `anon` / `authenticated` and the caller's JWT claims in `request.jwt.claims`.
 * `who` = { uid } for a signed-in user, or null for an anonymous visitor.
 */
export async function run(pg, who, sql, params = []) {
  return pg.transaction(async (tx) => {
    if (who) {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: who.uid, role: 'authenticated' })]);
    } else {
      await tx.exec('set local role anon');
      await tx.query("select set_config('request.jwt.claims', '', true)");
    }
    return tx.query(sql, params);
  });
}

/** Creates an account the way Supabase Auth does: a row in auth.users (the schema's triggers do the rest). */
export async function signUp(pg, { id, email, name = 'Test', phone = '', code, rosterId }) {
  const meta = { name, phone };
  if (code !== undefined) meta.invite_code = code;
  if (rosterId !== undefined) meta.roster_id = rosterId;
  const r = await pg.query(
    "insert into auth.users (id, email, raw_user_meta_data) values (coalesce($1::uuid, gen_random_uuid()), $2, $3::jsonb) returning id",
    [id ?? null, email, JSON.stringify(meta)]
  );
  return r.rows[0].id;
}
