// Looks at a REAL Supabase project from the outside with the PUBLIC key only: nothing is written and
// no account is created. Run it after 01-schema.sql, 02-seed.sql and "Confirm email OFF": it says what is missing.
//   node live-check.mjs https://<project ref>.supabase.co <publishable key> [consultant code]
// (or set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY and give no arguments)
import { checkSupabaseEnv } from '../check-supabase-env.mjs';

const [urlArg, keyArg, codeArg] = process.argv.slice(2);
const rawUrl = (urlArg ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const key = (keyArg ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
const code = (codeArg ?? '').trim();

if (!rawUrl || !key) {
  console.error('Usage: node live-check.mjs https://<project ref>.supabase.co <publishable key> [consultant code]');
  process.exit(2);
}

// A wrong paste (above all a SECRET key) stops here, before the value is sent anywhere.
const problems = checkSupabaseEnv(rawUrl, key);
for (const p of problems) console.log(`${p.fatal ? 'STOP' : 'note'}: ${p.text}`);
if (problems.some((p) => p.fatal)) process.exit(2);

const origin = new URL(rawUrl).origin;
const headers = { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) };

async function call(path, init = {}) {
  const res = await fetch(origin + path, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const checks = [];
const check = (name, fn) => checks.push([name, fn]);
const fail = (msg) => {
  throw new Error(msg);
};

let settings = null;

check('the project answers and accepts the key', async () => {
  let r;
  try {
    r = await call('/auth/v1/settings');
  } catch (e) {
    fail(`cannot reach ${new URL(origin).host} (${e.cause?.code ?? e.message}). Check the address (Project URL) and the internet connection.`);
  }
  if (r.status === 401 || r.status === 403) fail('the key is refused: copy the PUBLISHABLE key again (Project Settings → API Keys).');
  if (r.status !== 200 || typeof r.body !== 'object') fail(`unexpected answer ${r.status}: ${JSON.stringify(r.body).slice(0, 160)}`);
  settings = r.body;
});

check('"Confirm email" is OFF (a sign-up opens the app at once)', async () => {
  if (!settings) fail('skipped: the project did not answer.');
  if (settings.mailer_autoconfirm === undefined) fail('Supabase did not say; check Authentication → Sign In / Providers → Email by eye.');
  if (settings.mailer_autoconfirm !== true) {
    fail('it is still ON, so nobody could sign up (Supabase\'s free mail sender sends 2 mails an hour). Authentication → Sign In / Providers → Email → switch "Confirm email" OFF → Save.');
  }
});

check('e-mail sign-ups are allowed', async () => {
  if (!settings) fail('skipped: the project did not answer.');
  if (settings.disable_signup === true) fail('sign-ups are disabled: Authentication → Sign In / Providers → turn on "Allow new users to sign up".');
  if (settings.external && settings.external.email === false) fail('the Email provider is switched off: Authentication → Sign In / Providers → Email → enable.');
});

check('the database is set up (check_invite_code answers a visitor)', async () => {
  const r = await call('/rest/v1/rpc/check_invite_code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_code: '___not-a-real-code___' }),
  });
  const text = JSON.stringify(r.body ?? '').slice(0, 200);
  if (r.status === 404 || /PGRST20[25]/.test(text)) {
    fail('the function does not exist: run supabase/01-schema.sql in this project\'s SQL Editor (if you just did, wait a minute and run this check again).');
  }
  if (r.status === 401 || r.status === 403 || /42501/.test(text)) {
    fail('permission denied: run supabase/01-schema.sql again (its last part grants access), then run this check again.');
  }
  if (r.status !== 200) fail(`unexpected answer ${r.status}: ${text}`);
  if (r.body !== null) fail(`a made-up code was accepted (${text}): this is not the right database.`);
});

if (code) {
  check('the consultant code from 02-seed.sql is known to the database', async () => {
    const r = await call('/rest/v1/rpc/check_invite_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code }),
    });
    if (r.status !== 200) fail(`unexpected answer ${r.status}: ${JSON.stringify(r.body).slice(0, 160)}`);
    if (r.body === null) fail('that code is not known: run supabase/02-seed.sql, or the code was changed.');
    if (r.body !== 'consultant') fail(`that code opens a "${r.body}" account, not a consultant one (the staff code must stay private).`);
  });
}

check('the participants list answers a visitor only when the code is right', async () => {
  const ask = (p_code) =>
    call('/rest/v1/rpc/roster_choices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_code }) });
  const wrong = await ask('___not-a-real-code___');
  const text = JSON.stringify(wrong.body ?? '').slice(0, 200);
  if (wrong.status === 404 || /PGRST20[25]/.test(text)) {
    fail('the function roster_choices does not exist: run supabase/01-schema.sql again in this project\'s SQL Editor.');
  }
  if (wrong.status === 401 || wrong.status === 403 || /42501/.test(text)) fail('permission denied: run supabase/01-schema.sql again (its last part grants access).');
  if (wrong.status !== 200) fail(`unexpected answer ${wrong.status}: ${text}`);
  if (!Array.isArray(wrong.body) || wrong.body.length !== 0) fail('a made-up code was shown the names: this is not the right database.');
  if (!code) return;
  const right = await ask(code);
  if (right.status !== 200 || !Array.isArray(right.body)) fail(`unexpected answer ${right.status}: ${JSON.stringify(right.body).slice(0, 160)}`);
  if (right.body.length === 0) fail('the code is right but no participant is waiting: run supabase/02-seed.sql (or every name has already been taken).');
  const extra = Object.keys(right.body[0]).filter((k) => !['id', 'name', 'group'].includes(k));
  if (extra.length) fail(`the list gives more than id / name / group (${extra.join(', ')}).`);
  console.log(`      ${right.body.length} names are waiting: ${right.body.slice(0, 3).map((r) => r.name).join(', ')}…`);
});

for (const table of ['config', 'profiles', 'messages', 'schedule', 'roster', 'trip_groups']) {
  check(`a visitor cannot read "${table}"`, async () => {
    const r = await call(`/rest/v1/${table}?select=*&limit=1`);
    if (r.status === 200 && Array.isArray(r.body) && r.body.length > 0) {
      fail('ANYONE CAN READ IT. Do not share the link yet: run supabase/01-schema.sql again and tell me.');
    }
    // 200 with no rows (row-level security) or 401/403/404 (no access at all) are both fine.
    if (![200, 401, 403, 404].includes(r.status)) fail(`unexpected answer ${r.status}: ${JSON.stringify(r.body).slice(0, 160)}`);
  });
}

let failed = 0;
for (const [name, fn] of checks) {
  try {
    await fn();
    console.log('PASS', name);
  } catch (e) {
    failed++;
    console.log('FAIL', name, '\n      →', e.message);
  }
}
console.log(failed ? `\n${failed} problem(s) to fix, then run this check again.` : `\nAll ${checks.length} checks passed: the Supabase side is ready.`);
process.exit(failed ? 1 : 0);
