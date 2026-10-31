// The build guard (tools/check-supabase-env.mjs): a wrong paste must stop the build, a right one must pass.
import { checkSupabaseEnv } from '../check-supabase-env.mjs';

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const fatal = (url, key) => checkSupabaseEnv(url, key).filter((p) => p.fatal).map((p) => p.text);
const must = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// a legacy-style key (header.payload.signature), only the payload matters here
const jwt = (payload) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.c2lnbmF0dXJl`;
const URL_OK = 'https://abcdefghijklmnopqrst.supabase.co';

test('a normal project address with a publishable key passes without any remark', () => {
  eq(checkSupabaseEnv(URL_OK, 'sb_publishable_abc123'), []);
});

test('the legacy anon key of the same project passes', () => {
  eq(checkSupabaseEnv(URL_OK, jwt({ iss: 'supabase', ref: 'abcdefghijklmnopqrst', role: 'anon' })), []);
});

test('a SECRET key stops the build (new and legacy kind)', () => {
  must(fatal(URL_OK, 'sb_secret_abc123').some((t) => /SECRET/.test(t)), 'sb_secret_ was accepted');
  must(fatal(URL_OK, jwt({ ref: 'abcdefghijklmnopqrst', role: 'service_role' })).some((t) => /service_role/.test(t)), 'service_role was accepted');
});

test('the message never repeats the key itself', () => {
  const all = JSON.stringify(checkSupabaseEnv(URL_OK, 'sb_secret_TOPSECRETVALUE'));
  must(!all.includes('TOPSECRETVALUE'), 'the key was printed');
});

test('a key from another project, or the Lumina project address, stops the build', () => {
  must(fatal(URL_OK, jwt({ ref: 'zzzzzzzzzzzzzzzzzzzz', role: 'anon' })).length === 1, 'key of another project accepted');
  must(fatal('https://qxobfckprwlsgjwcbhri.supabase.co', 'sb_publishable_abc').some((t) => /Lumina/.test(t)), 'Lumina project accepted');
});

test('typical copy-paste slips stop the build', () => {
  must(fatal('"' + URL_OK + '"', 'sb_publishable_abc').length === 1, 'quotes accepted');
  must(fatal(URL_OK + '/rest/v1/', 'sb_publishable_abc').length === 1, 'path accepted');
  must(fatal('https://supabase.com/dashboard/project/abcdefghijklmnopqrst', 'sb_publishable_abc').length === 1, 'dashboard address accepted');
  must(fatal('http://abcdefghijklmnopqrst.supabase.co', 'sb_publishable_abc').length === 1, 'http accepted');
  must(fatal(URL_OK, 'sb_publishable_abc def').length === 1, 'space in the key accepted');
  must(fatal(URL_OK, 'sb_publishable_abc\n').length === 0, 'a trailing newline must be tolerated');
});

test('an empty value is only a remark (the app then shows its "not configured" notice)', () => {
  const p = checkSupabaseEnv('', '');
  must(p.length === 2 && p.every((x) => !x.fatal), 'empty values must not stop the build');
});

test('the local look-alike is allowed', () => {
  eq(fatal('http://127.0.0.1:54321', jwt({ role: 'anon' })), []);
});

function eq(a, b) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

let failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log('PASS', name);
  } catch (e) {
    failed++;
    console.log('FAIL', name, '\n     ', e.message);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} tests réussis`);
process.exit(failed ? 1 : 0);
