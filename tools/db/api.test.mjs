// End-to-end check of the app's REAL data layer (src/lib/api.ts) against the local Supabase look-alike:
// supabase-js -> HTTP -> row-level security on a real Postgres engine. Starts the look-alike itself.
//   cd tools/db && npm install && npm run test:api
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(here, '..', '..');
const requireApp = createRequire(path.join(appRoot, 'package.json'));
const ts = requireApp('typescript');
const { createClient } = requireApp('@supabase/supabase-js');

/* ---- start the look-alike (empty: this test makes its own people) */
const mock = spawn(process.execPath, [path.join(here, 'mock-supabase.mjs')], {
  env: { ...process.env, MOCK_EMPTY: '1', MOCK_API_PORT: '54399', MOCK_APP_PORT: '54398' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
let out = '';
await new Promise((resolve, reject) => {
  mock.stdout.on('data', (d) => {
    out += d;
    if (out.includes('app (from')) resolve();
  });
  mock.on('exit', (c) => reject(new Error('mock stopped: ' + c)));
  setTimeout(() => reject(new Error('mock did not start')), 60000);
});
const URL_ = 'http://127.0.0.1:54399';
const ANON = /EXPO_PUBLIC_SUPABASE_ANON_KEY=(\S+)/.exec(out)[1];
const CODES = { consultant: /consultants code: (\S+)/.exec(out)[1], staff: /staff code: (\S+)/.exec(out)[1] };

/* ---- load src/lib/api.ts for a given client (it normally imports the app's own client) */
const apiSource = ts.transpileModule(fs.readFileSync(path.join(appRoot, 'src', 'lib', 'api.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function loadApi(client) {
  const mod = { exports: {} };
  const fakeRequire = (name) => {
    if (name === './supabase') return { supabase: client };
    if (name === './live') return { notifyLocalChange() {} };
    throw new Error('unexpected import ' + name);
  };
  vm.runInNewContext(apiSource, { module: mod, exports: mod.exports, require: fakeRequire, console, Date, Math, globalThis }, { filename: 'api.ts' });
  return mod.exports;
}

const newClient = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 10 } } });

async function join(name, email, code) {
  const client = newClient();
  const { data, error } = await client.auth.signUp({ email, password: 'secret123', options: { data: { name, phone: '0555', invite_code: code } } });
  if (error) throw error;
  if (!data.session) throw new Error('no session after sign-up');
  return { client, api: loadApi(client), uid: data.user.id, name };
}

/* ---- tiny test runner */
let failed = 0;
const run = async (name, fn) => {
  try {
    await fn();
    console.log('PASS', name);
  } catch (e) {
    failed++;
    console.log('FAIL', name, '\n     ', e?.message ?? e);
  }
};
const eq = (a, b, m = '') => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const fails = async (p, re) => {
  try { await p; } catch (e) { if (re && !re.test(String(e?.message ?? e))) throw new Error(`rejected with "${e?.message}"`); return; }
  throw new Error('should have been rejected');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let staff, amina, karim;

await run('sign-up: wrong code, then the right ones', async () => {
  const bad = await newClient().auth.signUp({ email: 'bad@uc.test', password: 'secret123', options: { data: { name: 'Bad', invite_code: 'NOPE' } } });
  if (!bad.error) throw new Error('wrong code accepted');
  const anon = loadApi(newClient());
  eq(await anon.checkInviteCode('nope'), null);
  eq(await anon.checkInviteCode(CODES.consultant.toLowerCase()), 'consultant');
  eq(await anon.checkInviteCode(CODES.staff), 'staff');
  staff = await join('Sofia', 'sofia@uc.test', CODES.staff);
  amina = await join('Amina', 'amina@uc.test', CODES.consultant);
  karim = await join('Karim', 'karim@uc.test', CODES.consultant);
  const p = await amina.api.fetchProfile(amina.uid);
  eq([p.name, p.role, p.verified, p.locationSharing], ['Amina', 'consultant', false, false]);
  eq((await staff.api.fetchProfile(staff.uid)).role, 'staff');
  eq(await amina.api.fetchProfile(karim.uid), null, 'consultant read another profile');
  // signing in again
  const again = await newClient().auth.signInWithPassword({ email: 'amina@uc.test', password: 'secret123' });
  eq(again.data.user.id, amina.uid);
  const wrong = await newClient().auth.signInWithPassword({ email: 'amina@uc.test', password: 'oops' });
  eq(wrong.error.code, 'invalid_credentials');
});

await run('the trip, the programme and the guide come from the seed', async () => {
  const trip = await amina.api.fetchTrip();
  eq([trip.name, trip.startDate.toISOString().slice(0, 10), trip.endDate.toISOString().slice(0, 10)], ['Voyage Istanbul 2026', '2026-11-05', '2026-11-09']);
  const fri = await amina.api.fetchSchedule('2026-11-06');
  eq(fri.map((i) => i.time), ['—', '13:00', '17:00']);
  eq((await amina.api.fetchSchedule('2026-12-25')).length, 0);
  const places = await amina.api.fetchPlaces();
  if (places.length < 10 || !places.some((p) => p.name.includes('Hampton'))) throw new Error('guide missing');
  await fails(amina.api.deletePlace(places[0].id), /./).catch(() => {});
  eq((await amina.api.fetchPlaces()).length, places.length, 'consultant deleted a place');
});

await run('participants list: free names come with the code; taking one gives the real name, the group and the flights', async () => {
  const anon = loadApi(newClient());
  eq(await anon.fetchRosterChoices('nope'), []);
  const free = await anon.fetchRosterChoices(CODES.consultant);
  eq(free.length, 21);
  const khaoula = free.find((c) => c.name === 'Khentit Khaoula');
  eq(khaoula.groupId, 2);

  // signing up the way the app does it: the chosen id travels with the sign-up data
  const client = newClient();
  const { data, error } = await client.auth.signUp({
    email: 'khaoula@uc.test',
    password: 'secret123',
    options: { data: { name: 'typed differently', phone: '0555', invite_code: CODES.consultant, roster_id: khaoula.id } },
  });
  if (error) throw error;
  const api = loadApi(client);
  const p = await api.fetchProfile(data.user.id);
  eq([p.name, p.verified, p.groupId], ['Khentit Khaoula', true, 2]);

  // the flights of both groups are readable by a member, and by nobody else
  eq((await api.fetchTripGroups()).map((g) => [g.id, g.airline, g.outDep, g.outArr, g.backDep, g.backArr, g.bagHoldKg, g.bagHoldCount, g.bagCabinKg]), [
    [1, 'Air Algérie', '09:40', '15:15', '20:30', '22:00', 23, 2, 10],
    [2, 'Pegasus Airlines', '12:55', '18:30', '09:45', '11:35', 20, 1, 8],
  ]);
  eq((await anon.fetchTripGroups().catch(() => [])).length, 0, 'a visitor read the flights');

  // the name is gone from the list, and nobody else can take it
  eq((await anon.fetchRosterChoices(CODES.consultant)).length, 20);
  const twin = await newClient().auth.signUp({ email: 'twin@uc.test', password: 'secret123', options: { data: { name: 'x', invite_code: CODES.consultant, roster_id: khaoula.id } } });
  if (!twin.error) throw new Error('the same name was given twice');

  // staff see who has signed up and can move someone to the other group; she cannot do it herself
  const roster = await staff.api.fetchRoster();
  eq([roster.length, roster.filter((r) => r.profileUid).length], [25, 1]);   // 21 participants + 4 staff, one name taken
  await staff.api.setProfileGroup(data.user.id, 1);
  eq((await api.fetchProfile(data.user.id)).groupId, 1);
  eq((await staff.api.fetchRoster()).find((r) => r.name === 'Khentit Khaoula').groupId, 1);
  await fails(api.setProfileGroup(data.user.id, 2), /forbidden/);
  eq((await api.fetchRoster()).length, 0, 'a consultant read the roster');

  // removing the account frees the name again (and keeps the other tests below as they were)
  const del = await staff.client.from('profiles').delete().eq('uid', data.user.id);
  if (del.error) throw del.error;
  eq((await anon.fetchRosterChoices(CODES.consultant)).length, 21);
});

await run('staff edit the trip, the schedule and the guide', async () => {
  await staff.api.saveTrip({ name: 'Istanbul', startDate: new Date('2026-11-05T12:00:00Z'), endDate: new Date('2026-11-09T12:00:00Z') });
  eq((await amina.api.fetchTrip()).name, 'Istanbul');
  await staff.api.publishSchedule('2026-11-07', [{ id: 'x1', time: '10:00', title: 'Visite', important: true, createdBy: 'staff' }]);
  eq((await amina.api.fetchSchedule('2026-11-07')).map((i) => i.title), ['Visite']);
  await fails(amina.api.publishSchedule('2026-11-07', []), /row-level|permission/);
  await staff.api.savePlace(null, { category: 'tool', name: 'Wi-Fi', description: 'Réseau : test' });
  const wifi = (await staff.api.fetchPlaces()).find((p) => p.name === 'Wi-Fi');
  await staff.api.savePlace(wifi.id, { category: 'tool', name: 'Wi-Fi hôtel', description: '', address: 'Hall', lat: 41.01, lng: 28.97 });
  const edited = (await amina.api.fetchPlaces()).find((p) => p.id === wifi.id);
  eq([edited.name, edited.address, edited.lat], ['Wi-Fi hôtel', 'Hall', 41.01]);
  await staff.api.deletePlace(wifi.id);
  eq((await amina.api.fetchPlaces()).some((p) => p.id === wifi.id), false);
  // the company code: staff read and change it, consultants cannot
  eq(await staff.api.fetchInviteCode(), CODES.consultant);
  eq(await amina.api.fetchInviteCode(), '', 'consultant read the code');
  await staff.api.saveInviteCode('NEW-CODE-1');
  eq(await staff.api.fetchInviteCode(), 'NEW-CODE-1');
  eq(await newClient().rpc('check_invite_code', { p_code: 'new-code-1' }).then((r) => r.data), 'consultant');
});

await run('group chat: send, lock, unlock', async () => {
  await amina.api.sendGroupMessage('Bonjour tout le monde');
  const msgs = await karim.api.fetchGroupMessages();
  eq([msgs[0].text, msgs[0].senderName, msgs[0].senderRole, msgs[0].senderId], ['Bonjour tout le monde', 'Amina', 'consultant', amina.uid]);
  eq((await karim.api.fetchLatestGroupMessage()).text, 'Bonjour tout le monde');
  eq(await karim.api.fetchChatLock(), false);
  await staff.api.saveChatLock(true, staff.uid);
  eq(await karim.api.fetchChatLock(), true);
  await fails(karim.api.sendGroupMessage('verrouillé ?'), /row-level|violates/);
  await staff.api.sendGroupMessage('Annonce du staff');
  await staff.api.saveChatLock(false, staff.uid);
  await karim.api.sendGroupMessage('Merci');
  eq((await amina.api.fetchGroupMessages()).map((m) => m.text), ['Merci', 'Annonce du staff', 'Bonjour tout le monde']);
});

await run('private messages', async () => {
  eq(await amina.api.dmThreadExists(`${staff.uid}_${amina.uid}`), false);
  await fails(amina.api.sendDirectMessage({ staffId: staff.uid, consultantId: amina.uid, text: 'Salut ?' }), /thread_not_found|forbidden|permission|row-level/);
  await staff.api.sendDirectMessage({ staffId: staff.uid, consultantId: amina.uid, text: 'Bienvenue Amina' });
  await amina.api.sendDirectMessage({ staffId: staff.uid, consultantId: amina.uid, text: 'Merci !' });
  const t = await amina.api.fetchDmThreads();
  eq([t.length, t[0].staffName, t[0].consultantName, t[0].lastMessage, t[0].lastSenderId], [1, 'Sofia', 'Amina', 'Merci !', amina.uid]);
  eq((await staff.api.fetchDmMessages(`${staff.uid}_${amina.uid}`)).map((m) => m.text), ['Merci !', 'Bienvenue Amina']);
  eq((await karim.api.fetchDmThreads()).length, 0);
  eq((await karim.api.fetchDmMessages(`${staff.uid}_${amina.uid}`)).length, 0);
  eq(await amina.api.dmThreadExists(`${staff.uid}_${amina.uid}`), true);
});

await run('alerts, announcements and who has read them', async () => {
  const id = staff.api.newId();
  await staff.api.notifyUsers([amina.uid, karim.uid], 'broadcast', 'RDV à 9h dans le hall', { broadcastId: id });
  await staff.api.createBroadcast({ id, text: 'RDV à 9h dans le hall', audience: [amina.uid, karim.uid], createdBy: staff.uid });
  const a = await amina.api.fetchNotifications(amina.uid);
  eq([a.length, a[0].text, a[0].read, a[0].broadcastId], [1, 'RDV à 9h dans le hall', false, id]);
  await amina.api.markNotificationRead(a[0].id);
  eq((await amina.api.fetchNotifications(amina.uid))[0].read, true);
  eq((await amina.api.fetchNotifications(karim.uid)).length, 0, 'read another user feed');
  const [b] = await staff.api.fetchRecentBroadcasts(5);
  const receipts = await staff.api.readReceipts(b);
  eq([receipts.read, receipts.unread], [[amina.uid], [karim.uid]]);
  await fails(amina.api.createBroadcast({ id: staff.api.newId(), text: 'x', audience: [], createdBy: amina.uid }), /row-level/);
});

await run('roll-call', async () => {
  eq(await amina.api.fetchLatestCheckin(), null);
  const cid = await staff.api.openCheckin('Appel du soir', staff.uid);
  const latest = await amina.api.fetchLatestCheckin();
  eq([latest.id, latest.title, latest.closed], [cid, 'Appel du soir', false]);
  eq(await amina.api.hasAnsweredCheckin(cid, amina.uid), false);
  await amina.api.answerCheckin(cid, amina.uid, 'Amina');
  await amina.api.answerCheckin(cid, amina.uid, 'Amina');   // twice is fine
  eq(await amina.api.hasAnsweredCheckin(cid, amina.uid), true);
  eq((await staff.api.fetchCheckinResponses(cid)).map((r) => r.name), ['Amina']);
  eq((await karim.api.fetchCheckinResponses(cid)).length, 0);
  await staff.api.closeCheckin(cid);
  await fails(karim.api.answerCheckin(cid, karim.uid, 'Karim'), /row-level/);
});

await run('help requests', async () => {
  await amina.api.createHelpRequest({ uid: amina.uid, name: 'Amina', phone: '0555', lat: 41.01, lng: 28.97 });
  await amina.api.createHelpRequest({ uid: amina.uid, name: 'Amina', phone: '0555' });
  const open = await staff.api.fetchOpenHelpRequests();
  eq([open.length, open[0].lat, open[1].lat], [2, undefined, 41.01]);
  eq((await karim.api.fetchOpenHelpRequests()).length, 0);
  await staff.api.resolveHelpRequest(open[0].id);
  eq((await staff.api.fetchOpenHelpRequests()).length, 1);
  await fails(amina.api.createHelpRequest({ uid: karim.uid, name: 'Karim', phone: '' }), /row-level/);
});

await run('profiles: own details, location sharing, verification', async () => {
  await amina.api.updateOwnProfile(amina.uid, { name: 'Amina B.', phone: '0777' });
  await amina.api.setLocationSharing(amina.uid, true);
  await amina.api.saveLocation(amina.uid, 41.0136, 28.9738);
  const list = await staff.api.fetchConsultants();
  const a = list.find((c) => c.uid === amina.uid);
  eq([a.name, a.phone, a.locationSharing, a.location.lat, a.location.lng], ['Amina B.', '0777', true, 41.0136, 28.9738]);
  eq(list.map((c) => c.name), ['Amina B.', 'Karim']);
  await staff.api.setVerified(amina.uid, true);
  eq((await amina.api.fetchProfile(amina.uid)).verified, true);
  await fails(amina.api.setVerified(karim.uid, true), /./).catch(() => {});
  eq((await karim.api.fetchProfile(karim.uid)).verified, false, 'consultant verified someone');
  await amina.api.setLocationSharing(amina.uid, false);
  eq((await staff.api.fetchConsultants()).find((c) => c.uid === amina.uid).location, undefined);
  await amina.api.touchLastActive(amina.uid);
});

await run('real-time: a change reaches another device', async () => {
  const seen = [];
  const channel = karim.client
    .channel('t1')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (p) => seen.push(p.eventType))
    .subscribe();
  await sleep(800);
  await amina.api.sendGroupMessage('en direct');
  for (let i = 0; i < 20 && seen.length === 0; i++) await sleep(150);
  await karim.client.removeChannel(channel);
  eq(seen[0], 'INSERT');
});

mock.kill();
console.log(failed ? `\n${failed} échec(s)` : '\nTous les tests réussis');
process.exit(failed ? 1 : 0);
