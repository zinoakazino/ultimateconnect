// Tests of supabase/01-schema.sql + 02-seed.sql on a real Postgres engine: who can read / write what.
// Port of the Firestore rules tests (the app used to run on Firebase).
//   cd tools/db && npm install && npm test
import { createDb, run, signUp } from './lib.mjs';

const results = [];
let currentName = '';
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

const fails = async (promise, pattern) => {
  try {
    await promise;
  } catch (e) {
    if (pattern && !pattern.test(String(e.message))) throw new Error(`rejected with "${e.message}", expected ${pattern}`);
    return;
  }
  throw new Error('should have been rejected');
};
const eq = (a, b, msg = '') => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

const ID = {
  staff: '00000000-0000-4000-8000-000000000001',
  staff2: '00000000-0000-4000-8000-000000000002',
  amina: '00000000-0000-4000-8000-0000000000a1',
  karim: '00000000-0000-4000-8000-0000000000a2',
  ghost: '00000000-0000-4000-8000-0000000000ff',
};
const who = (uid) => ({ uid });

async function fresh() {
  const pg = await createDb({ seed: true });
  const codes = Object.fromEntries((await pg.query('select key, value from public.config')).rows.map((r) => [r.key, r.value]));
  await signUp(pg, { id: ID.staff, email: 'sofia@uc.test', name: 'Sofia', code: codes.staff_code });
  await signUp(pg, { id: ID.staff2, email: 'hichem@uc.test', name: 'Hichem', code: codes.staff_code });
  await signUp(pg, { id: ID.amina, email: 'amina@uc.test', name: 'Amina', phone: '0555', code: codes.invite_code });
  await signUp(pg, { id: ID.karim, email: 'karim@uc.test', name: 'Karim', code: codes.invite_code.toLowerCase() });
  return { pg, codes };
}

// ---------------------------------------------------------------------------------------------
test('seed: codes, trip, five schedule days, guide', async () => {
  const pg = await createDb({ seed: true });
  const codes = (await pg.query('select key, value from public.config order by key')).rows;
  eq(codes.map((c) => c.key), ['invite_code', 'staff_code']);
  if (!/^STAFF-[0-9A-F]{8}$/.test(codes[1].value)) throw new Error('staff code format: ' + codes[1].value);
  eq((await pg.query('select count(*)::int n from public.schedule')).rows[0].n, 5);
  eq((await pg.query('select count(*)::int n from public.trip')).rows[0].n, 1);
  if ((await pg.query('select count(*)::int n from public.places')).rows[0].n < 10) throw new Error('guide too small');
  // running the seed again must not change anything
  const before = JSON.stringify((await pg.query('select * from public.config order by key')).rows);
  await pg.exec((await import('./lib.mjs')).sqlFile('02-seed.sql'));
  eq(JSON.stringify((await pg.query('select * from public.config order by key')).rows), before, 'config changed on re-run');
});

test('schema can be run twice', async () => {
  const pg = await createDb({ seed: true });
  await pg.exec((await import('./lib.mjs')).sqlFile('01-schema.sql'));
});

// ---------------------------------------------------------------------------------------------
// Running the schema in the wrong Supabase project (e.g. the shop's) would put invite-code rules on ITS sign-ups.
test('the schema refuses to run in a project that already holds another app\'s tables', async () => {
  const lib = await import('./lib.mjs');
  const pg = await lib.createDb({ schema: false });
  await pg.exec('create table public.products (id int primary key, name text)');
  await fails(pg.exec(lib.sqlFile('01-schema.sql')), /STOP.*products/);
  // nothing was created, and the other app's table is untouched
  eq((await pg.query("select count(*)::int n from pg_tables where schemaname = 'public'")).rows[0].n, 1);
  eq((await pg.query("select count(*)::int n from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relname = 'users'")).rows[0].n, 0);
});

test('sign-up: wrong or missing invite code is refused, right ones create the right role', async () => {
  const { pg, codes } = await fresh();
  await fails(signUp(pg, { email: 'x@uc.test', name: 'X', code: 'NOPE' }), /invalid_invite_code/);
  await fails(signUp(pg, { email: 'y@uc.test', name: 'Y' }), /invalid_invite_code/);
  const roles = (await pg.query('select name, role from public.profiles order by name')).rows;
  eq(roles, [
    { name: 'Amina', role: 'consultant' },
    { name: 'Hichem', role: 'staff' },
    { name: 'Karim', role: 'consultant' }, // code typed in lower case
    { name: 'Sofia', role: 'staff' },
  ]);
  eq((await pg.query("select name from public.profiles where verified order by name")).rows.map((r) => r.name), ['Hichem', 'Sofia'], 'staff are verified, consultants wait for the team');
  // nobody created a half account
  eq((await pg.query("select count(*)::int n from auth.users where email in ('x@uc.test','y@uc.test')")).rows[0].n, 0);
  void codes;
});

test('check_invite_code is callable by a visitor and says which role the code gives', async () => {
  const { pg, codes } = await fresh();
  eq((await run(pg, null, 'select public.check_invite_code($1) r', [codes.invite_code])).rows[0].r, 'consultant');
  eq((await run(pg, null, 'select public.check_invite_code($1) r', [' ' + codes.staff_code.toLowerCase() + ' '])).rows[0].r, 'staff');
  eq((await run(pg, null, 'select public.check_invite_code($1) r', ['wrong'])).rows[0].r, null);
  await fails(run(pg, null, 'select * from public.config'), /permission denied/);
});

// A Supabase project created since 30 May 2026 opens nothing to the API by itself: 01-schema.sql grants what is
// needed (see lib.mjs, which starts from that stricter default). Visitors get no table at all.
test('visitors (not signed in) have no access to any table, only to check_invite_code', async () => {
  const { pg } = await fresh();
  const tables = (await pg.query("select tablename from pg_tables where schemaname = 'public' order by 1")).rows.map((r) => r.tablename);
  if (tables.length < 16) throw new Error('expected the 16 app tables, found ' + tables.length);
  for (const t of tables) {
    await fails(run(pg, null, `select * from public.${t}`), /permission denied/);
    await fails(run(pg, null, `insert into public.${t} default values`), /permission denied/);
    await fails(run(pg, null, `delete from public.${t}`), /permission denied/);
  }
  await fails(run(pg, null, 'select public.is_staff()'), /permission denied/);
  await fails(run(pg, null, 'select public.is_member()'), /permission denied/);
});

test('codes: only staff read or change them', async () => {
  const { pg } = await fresh();
  eq((await run(pg, who(ID.amina), 'select * from public.config')).rows.length, 0);
  eq((await run(pg, who(ID.staff), 'select * from public.config')).rows.length, 2);
  await run(pg, who(ID.staff), "update public.config set value = 'NEW-CODE' where key = 'invite_code'");
  eq((await run(pg, who(ID.staff), "select value from public.config where key='invite_code'")).rows[0].value, 'NEW-CODE');
  const r = await run(pg, who(ID.amina), "update public.config set value = 'HACK' where key = 'invite_code' returning 1");
  eq(r.rows.length, 0, 'consultant update touched a row');
});

// ---------------------------------------------------------------------------------------------
test('profiles: consultants see only themselves, staff see everyone, visitors nothing', async () => {
  const { pg } = await fresh();
  eq((await run(pg, who(ID.amina), 'select name from public.profiles')).rows, [{ name: 'Amina' }]);
  eq((await run(pg, who(ID.staff), 'select count(*)::int n from public.profiles')).rows[0].n, 4);
  await fails(run(pg, null, 'select * from public.profiles'), /permission denied/);
});

test('profiles: owner edits own fields but never role / verified', async () => {
  const { pg } = await fresh();
  await run(pg, who(ID.amina), "update public.profiles set name = 'Amina B', phone = '0777', location_sharing = true, location_lat = 41.01, location_lng = 28.97, location_updated_at = now(), last_active = now() where uid = $1", [ID.amina]);
  await fails(run(pg, who(ID.amina), "update public.profiles set role = 'staff' where uid = $1", [ID.amina]), /forbidden/);
  await fails(run(pg, who(ID.amina), 'update public.profiles set verified = true where uid = $1', [ID.amina]), /forbidden/);
  await fails(run(pg, who(ID.amina), "update public.profiles set email = 'x@y.z' where uid = $1", [ID.amina]), /forbidden/);
  const other = await run(pg, who(ID.amina), "update public.profiles set name = 'Hacked' where uid = $1 returning 1", [ID.karim]);
  eq(other.rows.length, 0, "touched someone else's profile");
  eq((await run(pg, who(ID.staff), 'select name, verified from public.profiles where uid = $1', [ID.amina])).rows[0], { name: 'Amina B', verified: false });
});

test('profiles: staff may only flip "verified" on other people', async () => {
  const { pg } = await fresh();
  await run(pg, who(ID.staff), 'update public.profiles set verified = true where uid = $1', [ID.amina]);
  eq((await run(pg, who(ID.staff), 'select verified from public.profiles where uid = $1', [ID.amina])).rows[0].verified, true);
  await fails(run(pg, who(ID.staff), "update public.profiles set name = 'Renamed' where uid = $1", [ID.amina]), /forbidden/);
  await fails(run(pg, who(ID.staff), "update public.profiles set role = 'staff' where uid = $1", [ID.amina]), /forbidden/);
  await fails(run(pg, who(ID.karim), 'update public.profiles set verified = true where uid = $1', [ID.karim]), /forbidden/);
  await run(pg, who(ID.staff), 'delete from public.profiles where uid = $1', [ID.karim]);
  eq((await run(pg, who(ID.staff), 'select count(*)::int n from public.profiles')).rows[0].n, 3);
  const del = await run(pg, who(ID.amina), 'delete from public.profiles where uid = $1 returning 1', [ID.amina]);
  eq(del.rows.length, 0, 'a consultant deleted a profile');
});

test('an account without a profile can read and write nothing', async () => {
  const { pg } = await fresh();
  const ghost = { uid: ID.ghost };
  eq((await run(pg, ghost, 'select * from public.trip')).rows.length, 0);
  eq((await run(pg, ghost, 'select * from public.messages')).rows.length, 0);
  await fails(run(pg, ghost, "insert into public.messages (text) values ('hi')"), /row-level|forbidden/);
});

// ---------------------------------------------------------------------------------------------
test('trip content: members read, staff write', async () => {
  const { pg } = await fresh();
  eq((await run(pg, who(ID.amina), 'select name from public.trip')).rows, [{ name: 'Voyage Istanbul 2026' }]);
  eq((await run(pg, who(ID.amina), "select jsonb_array_length(items)::int n from public.schedule where date = '2026-11-06'")).rows[0].n, 3);
  eq((await run(pg, who(ID.amina), 'select count(*)::int n from public.places')).rows[0].n > 5, true);
  await fails(run(pg, null, 'select * from public.schedule'), /permission denied/);
  await fails(run(pg, null, 'select * from public.messages'), /permission denied/);

  await fails(run(pg, who(ID.amina), "insert into public.places (category, name) values ('info', 'X')"), /row-level/);
  eq((await run(pg, who(ID.amina), "update public.trip set name = 'Hacked' returning 1")).rows.length, 0);
  eq((await run(pg, who(ID.amina), "delete from public.schedule where date = '2026-11-06' returning 1")).rows.length, 0);

  await run(pg, who(ID.staff), "insert into public.places (category, name, description) values ('tool', 'Wi-Fi', 'Réseau : test')");
  await run(pg, who(ID.staff), "insert into public.schedule (date, items) values ('2026-11-10', '[]') on conflict (date) do update set items = excluded.items");
  await run(pg, who(ID.staff), "update public.trip set name = 'Istanbul', end_date = '2026-11-10T12:00:00Z'");
  await fails(run(pg, who(ID.staff), "insert into public.schedule (date, items) values ('10/11/2026', '[]')"), /check/);
});

// ---------------------------------------------------------------------------------------------
test('group chat: sender comes from the profile; the lock stops consultants only', async () => {
  const { pg } = await fresh();
  // a client that lies about who it is gets its own identity anyway
  await run(pg, who(ID.amina), "insert into public.messages (sender_id, sender_name, sender_role, text, created_at) values ($1, 'Sofia', 'staff', 'Bonjour', '2001-01-01')", [ID.staff]);
  const m = (await run(pg, who(ID.karim), 'select sender_id, sender_name, sender_role, text, created_at from public.messages')).rows[0];
  eq([m.sender_id, m.sender_name, m.sender_role, m.text], [ID.amina, 'Amina', 'consultant', 'Bonjour']);
  if (new Date(m.created_at).getFullYear() < 2020) throw new Error('client chose created_at');

  await fails(run(pg, who(ID.amina), "insert into public.messages (text) values ('')"), /check|violates/);
  await fails(run(pg, who(ID.amina), 'insert into public.messages (text) values ($1)', ['x'.repeat(2001)]), /check|violates/);
  await fails(run(pg, null, "insert into public.messages (text) values ('anon')"), /permission denied/);

  await run(pg, who(ID.staff), "insert into public.chat_meta (id, locked) values ('group', true) on conflict (id) do update set locked = true");
  await fails(run(pg, who(ID.amina), "insert into public.messages (text) values ('locked?')"), /row-level/);
  await run(pg, who(ID.staff), "insert into public.messages (text) values ('Annonce')");
  await fails(run(pg, who(ID.amina), "update public.chat_meta set locked = false"), /row-level|permission/).catch(() => {});
  eq((await run(pg, who(ID.amina), "update public.chat_meta set locked = false returning 1")).rows.length, 0);
  await run(pg, who(ID.staff), "update public.chat_meta set locked = false where id = 'group'");
  await run(pg, who(ID.amina), "insert into public.messages (text) values ('Merci')");

  eq((await run(pg, who(ID.amina), 'delete from public.messages returning 1')).rows.length, 0, 'consultant deleted messages');
  eq((await run(pg, who(ID.amina), "update public.messages set text = 'edited' returning 1")).rows.length, 0, 'message edited');
  await run(pg, who(ID.staff), "delete from public.messages where text = 'Annonce'");
  eq((await run(pg, who(ID.staff), 'select count(*)::int n from public.messages')).rows[0].n, 2);
});

// ---------------------------------------------------------------------------------------------
test('private messages: staff opens the thread, only the two people read it', async () => {
  const { pg } = await fresh();
  const send = (uid, s, c, text) => run(pg, who(uid), 'select public.send_direct_message($1, $2, $3)', [s, c, text]);

  // a consultant cannot start a conversation
  await fails(send(ID.amina, ID.staff, ID.amina, 'Bonjour ?'), /forbidden|thread_not_found|42501/);
  // staff starts it
  await send(ID.staff, ID.staff, ID.amina, 'Bienvenue Amina');
  await send(ID.amina, ID.staff, ID.amina, 'Merci !');
  const t = (await run(pg, who(ID.amina), 'select id, staff_name, consultant_name, last_message, last_sender_id from public.dm_threads')).rows;
  eq(t.length, 1);
  eq([t[0].id, t[0].staff_name, t[0].consultant_name, t[0].last_message, t[0].last_sender_id], [`${ID.staff}_${ID.amina}`, 'Sofia', 'Amina', 'Merci !', ID.amina]);
  eq((await run(pg, who(ID.staff), 'select text, sender_role from public.dm_messages order by created_at')).rows.map((r) => [r.text, r.sender_role]), [['Bienvenue Amina', 'staff'], ['Merci !', 'consultant']]);

  // outsiders see nothing, neither the thread nor the messages
  for (const uid of [ID.karim, ID.staff2]) {
    eq((await run(pg, who(uid), 'select * from public.dm_threads')).rows.length, 0);
    eq((await run(pg, who(uid), 'select * from public.dm_messages')).rows.length, 0);
    await fails(send(uid, ID.staff, ID.amina, 'intrus'), /forbidden|42501/);
  }
  // nobody can write straight into the tables, or forge a sender
  await fails(run(pg, who(ID.amina), "insert into public.dm_messages (thread_id, sender_id, sender_name, sender_role, text) values ($1, $2, 'Sofia', 'staff', 'faux')", [`${ID.staff}_${ID.amina}`, ID.staff]), /row-level|permission/);
  await fails(run(pg, who(ID.staff), "insert into public.dm_threads (id, staff_id, staff_name, consultant_id, consultant_name) values ('x', $1, 'a', $2, 'b')", [ID.staff, ID.karim]), /row-level|permission/);
  // staff to a non-consultant, empty text, strangers
  await fails(send(ID.staff, ID.staff, ID.staff2, 'staff to staff'), /invalid_participants|22023/);
  await fails(send(ID.staff, ID.staff, ID.karim, '   '), /invalid_text|22023/);
  await fails(send(ID.staff, ID.staff2, ID.karim, 'as someone else'), /forbidden|42501/);
  await fails(run(pg, null, 'select public.send_direct_message($1, $2, $3)', [ID.staff, ID.amina, 'anon']), /permission denied/);
  // a long preview is shortened, the message is not
  await send(ID.staff, ID.staff, ID.karim, 'x'.repeat(500));
  eq((await run(pg, who(ID.karim), 'select char_length(last_message)::int n from public.dm_threads')).rows[0].n, 118);
  eq((await run(pg, who(ID.karim), 'select char_length(text)::int n from public.dm_messages')).rows[0].n, 500);
});

// ---------------------------------------------------------------------------------------------
test('alerts: staff create them, the owner reads and marks them read, nobody else', async () => {
  const { pg } = await fresh();
  const bid = '11111111-1111-4111-8111-111111111111';
  await run(pg, who(ID.staff), "insert into public.notifications (user_id, type, text, broadcast_id) values ($1, 'broadcast', 'RDV à 9h', $3), ($2, 'broadcast', 'RDV à 9h', $3)", [ID.amina, ID.karim, bid]);
  await run(pg, who(ID.staff), "insert into public.broadcasts (id, text, audience, created_by) values ($1, 'RDV à 9h', $2::uuid[], $3)", [bid, `{${ID.amina},${ID.karim}}`, ID.staff]);

  eq((await run(pg, who(ID.amina), 'select text, read from public.notifications')).rows, [{ text: 'RDV à 9h', read: false }]);
  await fails(run(pg, who(ID.amina), "insert into public.notifications (user_id, type, text) values ($1, 'chat', 'faux')", [ID.amina]), /row-level/);
  await fails(run(pg, who(ID.staff), "insert into public.notifications (user_id, type, text, read) values ($1, 'chat', 'x', true)", [ID.amina]), /row-level/);
  await fails(run(pg, who(ID.staff), "insert into public.notifications (user_id, type, text, broadcast_id) values ($1, 'chat', 'dup', $2)", [ID.amina, bid]), /duplicate|unique/);

  await run(pg, who(ID.amina), 'update public.notifications set read = true where user_id = $1', [ID.amina]);
  await fails(run(pg, who(ID.amina), "update public.notifications set text = 'changed' where user_id = $1", [ID.amina]), /forbidden/);
  eq((await run(pg, who(ID.amina), 'update public.notifications set read = true where user_id = $1 returning 1', [ID.karim])).rows.length, 0, "marked someone else's alert");
  eq((await run(pg, who(ID.staff), 'update public.notifications set read = true returning 1')).rows.length, 0, 'staff updated an alert');

  // "who has read it": staff look at the same broadcast id for every recipient
  const receipts = (await run(pg, who(ID.staff), 'select user_id, read from public.notifications where broadcast_id = $1 order by user_id', [bid])).rows;
  eq(receipts.map((r) => r.read), [true, false]);
  eq((await run(pg, who(ID.karim), 'select count(*)::int n from public.notifications')).rows[0].n, 1);
  eq((await run(pg, who(ID.karim), 'select count(*)::int n from public.broadcasts')).rows[0].n, 0);
  await fails(run(pg, who(ID.karim), "insert into public.broadcasts (text) values ('x')"), /row-level/);
  await run(pg, who(ID.staff), 'delete from public.notifications where user_id = $1', [ID.karim]);
});

// ---------------------------------------------------------------------------------------------
test('roll-call: one answer each, only while open, never for someone else', async () => {
  const { pg } = await fresh();
  await fails(run(pg, who(ID.amina), "insert into public.checkins (title) values ('Faux appel')"), /row-level/);
  const id = (await run(pg, who(ID.staff), "insert into public.checkins (title, created_by) values ('Appel de 18h', $1) returning id", [ID.staff])).rows[0].id;
  eq((await run(pg, who(ID.amina), 'select title, closed from public.checkins')).rows, [{ title: 'Appel de 18h', closed: false }]);

  // the name and time come from the database even if the client lies
  await run(pg, who(ID.amina), "insert into public.checkin_responses (checkin_id, uid, name, at) values ($1, $2, 'Autre nom', '2001-01-01') on conflict (checkin_id, uid) do update set at = now()", [id, ID.amina]);
  await run(pg, who(ID.amina), "insert into public.checkin_responses (checkin_id, uid, name) values ($1, $2, 'x') on conflict (checkin_id, uid) do update set at = now()", [id, ID.amina]);
  await run(pg, who(ID.karim), "insert into public.checkin_responses (checkin_id, uid, name) values ($1, $2, 'x')", [id, ID.amina]);   // lands as Karim's own answer

  eq((await run(pg, who(ID.staff), 'select name from public.checkin_responses order by name')).rows.map((r) => r.name), ['Amina', 'Karim']);
  eq((await run(pg, who(ID.amina), 'select name from public.checkin_responses')).rows.map((r) => r.name), ['Amina']);
  await run(pg, who(ID.staff), 'update public.checkins set closed = true where id = $1', [id]);
  eq((await run(pg, who(ID.amina), 'update public.checkins set closed = false returning 1')).rows.length, 0);
  await fails(run(pg, who(ID.staff2), "insert into public.checkin_responses (checkin_id, uid, name) values ($1, $2, 'x')", [id, ID.staff2]), /row-level/);
  await fails(run(pg, who(ID.amina), 'update public.checkin_responses set name = name returning 1'), /row-level/);   // answer edited after closing
  eq((await run(pg, who(ID.amina), 'delete from public.checkin_responses returning 1')).rows.length, 0);
  await run(pg, who(ID.staff), 'delete from public.checkin_responses where uid = $1', [ID.karim]);
});

// ---------------------------------------------------------------------------------------------
test('help requests: own only, staff resolve, the database writes who and when', async () => {
  const { pg } = await fresh();
  await run(pg, who(ID.amina), "insert into public.help_requests (uid, name, phone, lat, lng, message) values ($1, 'Amina', '0555', 41.01, 28.97, 'Perdue')", [ID.amina]);
  await fails(run(pg, who(ID.amina), "insert into public.help_requests (uid, name) values ($1, 'Karim')", [ID.karim]), /row-level/);
  await fails(run(pg, who(ID.amina), "insert into public.help_requests (uid, name, status) values ($1, 'Amina', 'resolved')", [ID.amina]), /row-level/);
  await fails(run(pg, null, "insert into public.help_requests (uid, name) values ($1, 'x')", [ID.amina]), /permission denied|row-level/);

  eq((await run(pg, who(ID.amina), 'select message from public.help_requests')).rows, [{ message: 'Perdue' }]);
  eq((await run(pg, who(ID.karim), 'select * from public.help_requests')).rows.length, 0);
  eq((await run(pg, who(ID.staff), "select count(*)::int n from public.help_requests where status = 'open'")).rows[0].n, 1);

  eq((await run(pg, who(ID.amina), "update public.help_requests set status = 'resolved' returning 1")).rows.length, 0, 'owner resolved own request');
  await fails(run(pg, who(ID.staff), "update public.help_requests set message = 'edited'"), /forbidden/);
  await run(pg, who(ID.staff), "update public.help_requests set status = 'resolved', resolved_by = $1", [ID.staff2]);
  const r = (await run(pg, who(ID.staff), 'select status, resolved_by, resolved_at from public.help_requests')).rows[0];
  eq([r.status, r.resolved_by, r.resolved_at !== null], ['resolved', ID.staff, true]);
  await run(pg, who(ID.staff), 'delete from public.help_requests');
});

// ---------------------------------------------------------------------------------------------
// Two groups fly at different times: the flights live in trip_groups, the 21 expected people are pre-registered
// in roster, and a schedule line can be for one group only ("group": 1 | 2).
const hhmm = (v) => (v ? String(v) : null);

test('seed: two groups with their own flights, 21 prepared accounts, group lines in the programme', async () => {
  const pg = await createDb({ seed: true });
  const groups = (await pg.query('select * from public.trip_groups order by id')).rows;
  // group 1 may check in TWO bags of 23 kg ("23 kg x 2"); group 2 one bag of 20 kg
  eq(groups.map((g) => [g.id, g.airline, g.out_dep, g.out_arr, g.back_dep, g.back_arr, g.meet_time, g.bag_hold_kg, g.bag_hold_count, g.bag_cabin_kg, g.hotel_arrival, g.checkout_by]), [
    [1, 'Air Algérie', '09:40', '15:15', '20:30', '22:00', '06:30', 23, 2, 10, '18:00', null],
    [2, 'Pegasus Airlines', '12:55', '18:30', '09:45', '11:35', '10:30', 20, 1, 8, '22:00', '05:00'],
  ]);
  // the two free texts are also in Arabic (shown when the app is in Arabic); group 2's note says it lands at another airport
  eq(groups.map((g) => [g.meet_place_ar.length > 0, g.note_ar.length > 0]), [[true, false], [true, true]]);
  const roster = (await pg.query('select group_id, count(*)::int n from public.roster group by group_id order by group_id')).rows;
  eq(roster, [{ group_id: 1, n: 14 }, { group_id: 2, n: 7 }]);
  eq((await pg.query('select count(*)::int n from public.roster where profile_uid is not null')).rows[0].n, 0);

  // the programme and the group sheet say the same thing, for each group
  const days = Object.fromEntries((await pg.query('select date, items from public.schedule')).rows.map((r) => [r.date, r.items]));
  for (const g of groups) {
    const mine = (date) => days[date].filter((i) => i.group === g.id);
    const has = (date, time, re) => {
      if (!mine(date).some((i) => i.time === time && re.test(i.title))) throw new Error(`group ${g.id}, ${date}: no "${time}" line matching ${re}`);
    };
    has('2026-11-05', g.out_dep, new RegExp(`Envol d.Alger.*${g.airline}`));
    has('2026-11-05', g.out_arr, /Atterrissage/);
    has('2026-11-05', g.meet_time, /Rendez-vous à l.aéroport d.Alger/);
    has('2026-11-05', g.hotel_arrival, /Arrivée à l.hôtel/);
    has('2026-11-09', g.back_dep, new RegExp(`Envol d.Istanbul.*${g.airline}`));
    has('2026-11-09', g.back_arr, /Arrivée à Alger/);
    if (g.checkout_by) has('2026-11-09', hhmm(g.checkout_by), /Check-out/);
  }
  // the days shared by everyone have no "group" at all
  for (const date of ['2026-11-06', '2026-11-07', '2026-11-08']) {
    if (days[date].some((i) => i.group !== undefined)) throw new Error(date + ' should be for everybody');
  }
});

test('seed: run again, it upgrades untouched programme days but never what the staff changed', async () => {
  const { pg } = await fresh();
  const seed = (await import('./lib.mjs')).sqlFile('02-seed.sql');
  const old = JSON.stringify([{ id: 'o1', time: '09:40', title: 'Envol (ancien programme)', important: true, createdBy: '' }]);
  const mine = JSON.stringify([{ id: '1730000000000-ab12cd', time: '10:00', title: 'Ajouté par le staff', important: false, createdBy: 'staff' }]);
  await pg.query("update public.schedule set items = $1::jsonb where date = '2026-11-05'", [old]);       // seed lines only: old version
  await pg.query("update public.schedule set items = $1::jsonb where date = '2026-11-06'", [mine]);      // staff edited this day
  await pg.query("update public.schedule set items = '[]' where date = '2026-11-08'");                   // staff emptied this day
  await pg.exec(seed);
  const items = async (d) => (await pg.query('select items from public.schedule where date = $1', [d])).rows[0].items;
  eq((await items('2026-11-05')).length, 9, 'the untouched day gets the new programme');
  eq((await items('2026-11-06')).map((i) => i.title), ['Ajouté par le staff'], 'a staff edit was overwritten');
  eq(await items('2026-11-08'), [], 'an emptied day was refilled');
  eq((await pg.query('select count(*)::int n from public.roster')).rows[0].n, 21, 'the roster doubled');

  // a project that got an older seed (one 23 kg bag for group 1) is corrected by running the seed again...
  const bags = async () => (await pg.query('select bag_hold_kg, bag_hold_count from public.trip_groups where id = 1')).rows[0];
  await pg.query('update public.trip_groups set bag_hold_count = 1 where id = 1');
  await pg.exec(seed);
  eq(await bags(), { bag_hold_kg: 23, bag_hold_count: 2 }, 'an older seed was not corrected');
  // ...but a weight or a count the staff changed themselves is left alone
  await pg.query('update public.trip_groups set bag_hold_kg = 30, bag_hold_count = 1 where id = 1');
  await pg.exec(seed);
  eq(await bags(), { bag_hold_kg: 30, bag_hold_count: 1 }, 'a staff edit was overwritten');
});

const nameId = async (pg, name) => (await pg.query('select id from public.roster where full_name = $1', [name])).rows[0].id;
const choices = async (pg, who_, code) => (await run(pg, who_, 'select public.roster_choices($1) r', [code])).rows[0].r;

test('roster: choosing your name gives your real name, your group and a validated account', async () => {
  const { pg, codes } = await fresh();
  const rid = await nameId(pg, 'Khentit Khaoula');
  const uid = await signUp(pg, { email: 'khaoula@uc.test', name: 'k', phone: '0555', code: codes.invite_code, rosterId: rid });
  const p = (await pg.query('select name, role, verified, group_id from public.profiles where uid = $1', [uid])).rows[0];
  eq(p, { name: 'Khentit Khaoula', role: 'consultant', verified: true, group_id: 2 }, 'the typed name wins over the list');
  eq((await pg.query('select profile_uid from public.roster where id = $1', [rid])).rows[0].profile_uid, uid);

  // without choosing a name nothing changes: unvalidated, no group
  const other = (await pg.query('select name, verified, group_id from public.profiles where uid = $1', [ID.amina])).rows[0];
  eq(other, { name: 'Amina', verified: false, group_id: null });

  // a name can be taken only once, and a refused sign-up leaves no half account
  await fails(signUp(pg, { email: 'twin@uc.test', code: codes.invite_code, rosterId: rid }), /roster_unavailable/);
  eq((await pg.query("select count(*)::int n from auth.users where email = 'twin@uc.test'")).rows[0].n, 0);
  // a staff code cannot take a consultant's name, and a made-up id is refused
  await fails(signUp(pg, { email: 's@uc.test', code: codes.staff_code, rosterId: await nameId(pg, 'Cheikh Aida') }), /roster_unavailable/);
  await fails(signUp(pg, { email: 'z@uc.test', code: codes.invite_code, rosterId: '00000000-0000-4000-8000-0000000000ee' }), /roster_unavailable/);
  await fails(signUp(pg, { email: 'n@uc.test', code: codes.invite_code, rosterId: 'not-a-uuid' }), /roster_unavailable/);
  await fails(signUp(pg, { email: 'c@uc.test', code: 'NOPE', rosterId: await nameId(pg, 'Cheikh Aida') }), /invalid_invite_code/);
});

test('roster: a name staff added for the team can only be taken with the staff code', async () => {
  const { pg, codes } = await fresh();
  await pg.query("insert into public.roster (full_name, role, group_id) values ('Zineddine S', 'staff', 1)");
  const sid = await nameId(pg, 'Zineddine S');
  await fails(signUp(pg, { email: 'a@uc.test', code: codes.invite_code, rosterId: sid }), /roster_unavailable/);
  const uid = await signUp(pg, { email: 'zs@uc.test', code: codes.staff_code, rosterId: sid });
  eq((await pg.query('select name, role, group_id from public.profiles where uid = $1', [uid])).rows[0], { name: 'Zineddine S', role: 'staff', group_id: 1 });
});

test('roster_choices: a visitor sees the free names only with a valid code', async () => {
  const { pg, codes } = await fresh();
  const free = await choices(pg, null, codes.invite_code);
  eq(free.length, 21);
  eq(free.find((x) => x.name === 'Khentit Khaoula').group, 2);
  eq(free.find((x) => x.name === 'Cheikh Aida').group, 1);
  eq(Object.keys(free[0]).sort(), ['group', 'id', 'name'], 'nothing else leaks');
  eq(free.map((x) => x.name), free.map((x) => x.name).slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).filter(Boolean), 'sorted by name');
  eq(await choices(pg, null, 'wrong'), [], 'a wrong code sees nothing');
  eq(await choices(pg, null, ''), [], 'no code sees nothing');
  eq(await choices(pg, null, codes.staff_code), [], 'the staff code opens the staff names (none here)');
  // taken names disappear from the list
  await signUp(pg, { email: 'k@uc.test', code: codes.invite_code, rosterId: await nameId(pg, 'Khentit Khaoula') });
  const left = await choices(pg, null, codes.invite_code.toLowerCase());
  eq([left.length, left.some((x) => x.name === 'Khentit Khaoula')], [20, false]);
  // the table itself stays closed
  await fails(run(pg, null, 'select * from public.roster'), /permission denied/);
  eq((await run(pg, who(ID.amina), 'select * from public.roster')).rows.length, 0, 'a consultant reads the roster');
  eq((await run(pg, who(ID.staff), 'select * from public.roster')).rows.length, 21);
});

test('roster: deleting an account frees its name again', async () => {
  const { pg, codes } = await fresh();
  const rid = await nameId(pg, 'Fouad Mehabli');
  const uid = await signUp(pg, { email: 'f@uc.test', code: codes.invite_code, rosterId: rid });
  eq((await choices(pg, null, codes.invite_code)).length, 20);
  await run(pg, who(ID.staff), 'delete from public.profiles where uid = $1', [uid]);
  eq((await pg.query('select profile_uid from public.roster where id = $1', [rid])).rows[0].profile_uid, null);
  eq((await choices(pg, null, codes.invite_code)).length, 21);
});

test('groups: members read the flights, only staff change them and who is in which group', async () => {
  const { pg } = await fresh();
  eq((await run(pg, who(ID.amina), 'select id from public.trip_groups order by id')).rows, [{ id: 1 }, { id: 2 }]);
  await fails(run(pg, null, 'select * from public.trip_groups'), /permission denied/);
  eq((await run(pg, who(ID.amina), "update public.trip_groups set out_dep = '01:00' returning 1")).rows.length, 0, 'a consultant changed a flight');
  await run(pg, who(ID.staff), "update public.trip_groups set out_dep = '10:05' where id = 1");
  eq((await run(pg, who(ID.amina), 'select out_dep from public.trip_groups where id = 1')).rows[0].out_dep, '10:05');
  await fails(run(pg, who(ID.staff), "update public.trip_groups set out_dep = '9:40' where id = 1"), /check/);

  // nobody picks their own group; staff do, for anyone (and for themselves)
  await fails(run(pg, who(ID.amina), 'update public.profiles set group_id = 2 where uid = $1', [ID.amina]), /forbidden/);
  await run(pg, who(ID.staff), 'update public.profiles set group_id = 2 where uid = $1', [ID.amina]);
  eq((await run(pg, who(ID.amina), 'select group_id from public.profiles where uid = $1', [ID.amina])).rows[0].group_id, 2);
  await run(pg, who(ID.staff), 'update public.profiles set group_id = 1 where uid = $1', [ID.staff]);
  await run(pg, who(ID.staff), 'update public.profiles set group_id = null where uid = $1', [ID.amina]);
  await fails(run(pg, who(ID.staff), 'update public.profiles set group_id = 7 where uid = $1', [ID.amina]), /foreign key|violates/);
  // a staff member still cannot rename someone while changing the group
  await fails(run(pg, who(ID.staff), "update public.profiles set group_id = 1, name = 'X' where uid = $1", [ID.amina]), /forbidden/);
});

// ---------------------------------------------------------------------------------------------
test('realtime: every table the app listens to is published (all but the codes)', async () => {
  const { pg } = await fresh();
  const names = (await pg.query("select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1")).rows.map((r) => r.tablename);
  const tables = (await pg.query("select tablename from pg_tables where schemaname = 'public' order by 1")).rows.map((r) => r.tablename);
  for (const t of tables.filter((n) => n !== 'config')) {
    if (!names.includes(t)) throw new Error('not published: ' + t);
  }
  if (names.includes('config')) throw new Error('the codes must never be published');
});

// ---------------------------------------------------------------------------------------------
let failed = 0;
for (const [name, fn] of tests) {
  currentName = name;
  try {
    await fn();
    results.push(['PASS', name]);
    console.log('PASS', name);
  } catch (e) {
    failed++;
    results.push(['FAIL', name]);
    console.log('FAIL', name, '\n     ', e.message);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} tests réussis`);
process.exit(failed ? 1 : 0);
void currentName;
