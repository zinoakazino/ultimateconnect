// Stops the web build when the two Supabase values look wrong. Most important: a SECRET key pasted instead
// of the publishable one would be baked into the public web page and open the whole database to everyone.
//   node tools/check-supabase-env.mjs      (runs by itself before `expo export` in `npm run build:web`)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Other Supabase projects of the same owner: this app must never be pointed at them.
const OTHER_PROJECTS = { qxobfckprwlsgjwcbhri: 'Lumina Beauty' };

function jwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

const isLocal = (host) => host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

/** Returns a list of { fatal, text }: fatal ones must stop the build, the others are only worth a look. */
export function checkSupabaseEnv(rawUrl = '', rawKey = '') {
  const out = [];
  const bad = (text) => out.push({ fatal: true, text });
  const warn = (text) => out.push({ fatal: false, text });
  const url = rawUrl.trim();
  const key = rawKey.trim();
  let urlRef = '';

  // ---- the project address
  if (!url) {
    warn('EXPO_PUBLIC_SUPABASE_URL is empty: the app will open on a "not configured" notice.');
  } else if (/["'\s]/.test(url)) {
    bad('EXPO_PUBLIC_SUPABASE_URL contains quotes or spaces: paste the plain address only, e.g. https://abcdefghijklmnop.supabase.co');
  } else {
    let u = null;
    try {
      u = new URL(url);
    } catch {
      /* reported below */
    }
    if (!u) {
      bad('EXPO_PUBLIC_SUPABASE_URL is not a web address. It looks like https://abcdefghijklmnop.supabase.co');
    } else if (/(^|\.)supabase\.com$/.test(u.hostname)) {
      bad('EXPO_PUBLIC_SUPABASE_URL is the address of the Supabase dashboard. Use the project address: https://<project ref>.supabase.co');
    } else if (u.pathname !== '/' || u.search || u.hash) {
      bad('EXPO_PUBLIC_SUPABASE_URL must be the project address only (https://<project ref>.supabase.co), without /rest/v1 or anything after it.');
    } else if (u.protocol !== 'https:' && !isLocal(u.hostname)) {
      bad('EXPO_PUBLIC_SUPABASE_URL must start with https://');
    } else if (u.hostname.endsWith('.supabase.co')) {
      urlRef = u.hostname.split('.')[0];
      if (OTHER_PROJECTS[urlRef]) {
        bad(`EXPO_PUBLIC_SUPABASE_URL points at the ${OTHER_PROJECTS[urlRef]} project. This app needs its own, separate Supabase project.`);
      }
    } else if (!isLocal(u.hostname)) {
      warn(`EXPO_PUBLIC_SUPABASE_URL (${u.hostname}) is not a *.supabase.co address: fine only if that is a custom domain of your project.`);
    }
  }

  // ---- the public key
  if (!key) {
    warn('EXPO_PUBLIC_SUPABASE_ANON_KEY is empty: the app will open on a "not configured" notice.');
  } else if (/["'\s]/.test(key)) {
    bad('EXPO_PUBLIC_SUPABASE_ANON_KEY contains quotes or spaces: paste the key alone, without quotes.');
  } else if (key.startsWith('sb_secret_')) {
    bad(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY is a SECRET key (sb_secret_…). It would be public in the web page and give everyone full access ' +
        'to the database. Use the PUBLISHABLE key (sb_publishable_…): Supabase → Project Settings → API Keys.'
    );
  } else if (key.startsWith('sb_publishable_')) {
    // the right kind
  } else {
    const payload = jwtPayload(key);
    if (!payload) {
      warn('EXPO_PUBLIC_SUPABASE_ANON_KEY does not look like a Supabase key (expected sb_publishable_… or the long eyJ… "anon" key).');
    } else if (payload.role === 'service_role') {
      bad(
        'EXPO_PUBLIC_SUPABASE_ANON_KEY is the "service_role" key. It would be public in the web page and give everyone full access ' +
          'to the database. Use the PUBLISHABLE key (sb_publishable_…) or the "anon" key.'
      );
    } else if (payload.role && payload.role !== 'anon') {
      bad(`EXPO_PUBLIC_SUPABASE_ANON_KEY is a "${payload.role}" key; the app needs the "anon" key (or the publishable key).`);
    } else if (payload.ref && urlRef && payload.ref !== urlRef) {
      bad('EXPO_PUBLIC_SUPABASE_ANON_KEY belongs to another Supabase project than EXPO_PUBLIC_SUPABASE_URL: copy both from the same project.');
    }
  }
  return out;
}

/** Same lookup Expo does, minus the fancy parts: real environment variables first, then the .env files. */
function readEnv(name, dir) {
  if (process.env[name] !== undefined) return process.env[name];
  for (const file of ['.env.production.local', '.env.local', '.env.production', '.env']) {
    try {
      const line = fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='));
      if (line) return line.slice(name.length + 1);
    } catch {
      /* no such file */
    }
  }
  return '';
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const problems = checkSupabaseEnv(readEnv('EXPO_PUBLIC_SUPABASE_URL', root), readEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', root));
  for (const p of problems) console.error(`${p.fatal ? '✗ STOP' : '! note'}: ${p.text}`);
  if (problems.some((p) => p.fatal)) {
    console.error('\nBuild stopped on purpose: fix the value in Render → Environment (or in your .env file) and build again.');
    process.exit(1);
  }
  if (!problems.length) console.log('Supabase settings look right.');
}
