// Everything the app reads from / writes to the database (Supabase), in one place.
// Rows use snake_case columns; the rest of the app sees the camelCase shapes of types/models.ts.
import { supabase } from './supabase';
import { notifyLocalChange } from './live';
import type {
  BroadcastDoc,
  CheckinDoc,
  CheckinResponseDoc,
  DmThreadDoc,
  HelpRequestDoc,
  MessageDoc,
  NotificationDoc,
  NotificationType,
  PlaceDoc,
  RosterChoice,
  RosterEntry,
  ScheduleDoc,
  ScheduleItem,
  TripDoc,
  TripGroupDoc,
  UserDoc,
} from '../types/models';

const date = (v: unknown): Date | null => (typeof v === 'string' && v ? new Date(v) : null);
const must = <T>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw res.error;
  return res.data as T;
};

/** A random id (uuid v4) made on the device, e.g. to give an announcement the same id for every recipient. */
export function newId() {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID() as string;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ---------------------------------------------------------------- profiles */

const toProfile = (r: any): UserDoc => ({
  uid: r.uid,
  name: r.name,
  phone: r.phone ?? '',
  email: r.email ?? '',
  role: r.role,
  verified: Boolean(r.verified),
  locationSharing: Boolean(r.location_sharing),
  location:
    r.location_lat != null && r.location_lng != null
      ? { lat: r.location_lat, lng: r.location_lng, updatedAt: date(r.location_updated_at) }
      : undefined,
  groupId: r.group_id ?? null,
  lastActive: date(r.last_active),
  createdAt: date(r.created_at),
});

export async function fetchProfile(uid: string) {
  const data = must(await supabase.from('profiles').select('*').eq('uid', uid).maybeSingle());
  return data ? toProfile(data) : null;
}

export async function fetchConsultants() {
  const rows = must(await supabase.from('profiles').select('*').eq('role', 'consultant').order('name'));
  return (rows ?? []).map(toProfile);
}

export async function touchLastActive(uid: string) {
  await supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('uid', uid);
}

export async function updateOwnProfile(uid: string, patch: { name?: string; phone?: string }) {
  const res = await supabase.from('profiles').update(patch).eq('uid', uid).select('uid');
  if (res.error) throw res.error;
  notifyLocalChange('profiles');
}

export async function setLocationSharing(uid: string, on: boolean) {
  const patch = on
    ? { location_sharing: true }
    : { location_sharing: false, location_lat: null, location_lng: null, location_updated_at: null };
  const res = await supabase.from('profiles').update(patch).eq('uid', uid).select('uid');
  if (res.error) throw res.error;
  notifyLocalChange('profiles');
}

export async function saveLocation(uid: string, lat: number, lng: number) {
  await supabase
    .from('profiles')
    .update({ location_lat: lat, location_lng: lng, location_updated_at: new Date().toISOString() })
    .eq('uid', uid);
}

export async function setVerified(uid: string, verified: boolean) {
  const res = await supabase.from('profiles').update({ verified }).eq('uid', uid).select('uid');
  if (res.error) throw res.error;
  notifyLocalChange('profiles');
}

/* ------------------------------------------------- travel groups and the roster */

const toGroup = (r: any): TripGroupDoc => ({
  id: r.id,
  name: r.name,
  airline: r.airline ?? '',
  outDate: r.out_date,
  outFrom: r.out_from ?? '',
  outTo: r.out_to ?? '',
  outDep: r.out_dep,
  outArr: r.out_arr,
  backDate: r.back_date,
  backFrom: r.back_from ?? '',
  backTo: r.back_to ?? '',
  backDep: r.back_dep,
  backArr: r.back_arr,
  meetTime: r.meet_time ?? null,
  meetPlace: r.meet_place ?? '',
  bagHoldKg: r.bag_hold_kg ?? null,
  bagHoldCount: r.bag_hold_count ?? 1,
  bagCabinKg: r.bag_cabin_kg ?? null,
  hotelArrival: r.hotel_arrival ?? null,
  checkoutBy: r.checkout_by ?? null,
  note: r.note ?? '',
  meetPlaceAr: r.meet_place_ar ?? '',
  noteAr: r.note_ar ?? '',
});

export async function fetchTripGroups() {
  const rows = must(await supabase.from('trip_groups').select('*').order('id'));
  return (rows ?? []).map(toGroup);
}

/** Staff only. Moves one person to another travel group (or to none): their flights follow. */
export async function setProfileGroup(uid: string, groupId: number | null) {
  const res = await supabase.from('profiles').update({ group_id: groupId }).eq('uid', uid).select('uid');
  if (res.error) throw res.error;
  // keep the participants list in step (it is what the next sign-up of this name would copy)
  await supabase.from('roster').update({ group_id: groupId }).eq('profile_uid', uid);
  notifyLocalChange('profiles', 'roster');
}

/** The participants staff prepared in advance, with who has signed up (staff only). */
export async function fetchRoster(): Promise<RosterEntry[]> {
  const rows = must(await supabase.from('roster').select('*').order('full_name'));
  return (rows ?? []).map((r: any) => ({
    id: r.id,
    name: r.full_name,
    role: r.role,
    groupId: r.group_id ?? null,
    profileUid: r.profile_uid ?? null,
  }));
}

/** The names still free in the participants list, for someone who knows the invite code (empty for a wrong code). */
export async function fetchRosterChoices(code: string): Promise<RosterChoice[]> {
  const res = await supabase.rpc('roster_choices', { p_code: code });
  if (res.error) throw res.error;
  return ((res.data as any[]) ?? []).map((r) => ({ id: r.id, name: r.name, groupId: r.group ?? null }));
}

/* ------------------------------------------------------------ invite codes */

/** 'consultant' | 'staff' | null — what the typed company code gives access to. */
export async function checkInviteCode(code: string) {
  const res = await supabase.rpc('check_invite_code', { p_code: code });
  if (res.error) throw res.error;
  return (res.data as string | null) ?? null;
}

export async function fetchInviteCode() {
  const data: any = must(await supabase.from('config').select('value').eq('key', 'invite_code').maybeSingle());
  return (data?.value as string | undefined) ?? '';
}

export async function saveInviteCode(code: string) {
  const res = await supabase.from('config').upsert({ key: 'invite_code', value: code }, { onConflict: 'key' });
  if (res.error) throw res.error;
}

/* ----------------------------------------------------- trip, schedule, guide */

export async function fetchTrip(): Promise<TripDoc | null> {
  const r: any = must(await supabase.from('trip').select('*').eq('id', 'current').maybeSingle());
  return r ? { name: r.name, nameAr: r.name_ar ?? '', startDate: new Date(r.start_date), endDate: new Date(r.end_date) } : null;
}

export async function saveTrip(trip: { name: string; nameAr?: string; startDate: Date; endDate: Date }) {
  const res = await supabase.from('trip').upsert(
    {
      id: 'current',
      name: trip.name,
      name_ar: trip.nameAr ?? '',
      start_date: trip.startDate.toISOString(),
      end_date: trip.endDate.toISOString(),
    },
    { onConflict: 'id' }
  );
  if (res.error) throw res.error;
  notifyLocalChange('trip');
}

export async function fetchSchedule(dateKey: string): Promise<ScheduleItem[]> {
  const r: any = must(await supabase.from('schedule').select('items').eq('date', dateKey).maybeSingle());
  return (r?.items as ScheduleItem[] | undefined) ?? [];
}

/** Every published day, in date order (the whole trip programme). */
export async function fetchAllSchedule(): Promise<ScheduleDoc[]> {
  const rows = must(await supabase.from('schedule').select('date, items').order('date', { ascending: true }));
  return (rows ?? []).map((r: any) => ({ date: r.date, items: (r.items as ScheduleItem[]) ?? [], updatedAt: null }));
}

export async function publishSchedule(dateKey: string, items: ScheduleItem[]) {
  const res = await supabase
    .from('schedule')
    .upsert({ date: dateKey, items, updated_at: new Date().toISOString() }, { onConflict: 'date' });
  if (res.error) throw res.error;
  notifyLocalChange('schedule');
}

const toPlace = (r: any): PlaceDoc => ({
  id: r.id,
  category: r.category,
  name: r.name,
  description: r.description ?? '',
  nameAr: r.name_ar ?? '',
  descriptionAr: r.description_ar ?? '',
  ...(r.address ? { address: r.address } : {}),
  ...(r.phone ? { phone: r.phone } : {}),
  ...(r.lat != null ? { lat: r.lat } : {}),
  ...(r.lng != null ? { lng: r.lng } : {}),
});

export async function fetchPlaces() {
  const rows = must(await supabase.from('places').select('*').order('name'));
  return (rows ?? []).map(toPlace);
}

export async function savePlace(id: string | null, place: Omit<PlaceDoc, 'id'>) {
  const row = {
    ...(id ? { id } : {}),
    category: place.category,
    name: place.name,
    description: place.description ?? '',
    name_ar: place.nameAr ?? '',
    description_ar: place.descriptionAr ?? '',
    address: place.address ?? null,
    phone: place.phone ?? null,
    lat: place.lat ?? null,
    lng: place.lng ?? null,
  };
  const res = id
    ? await supabase.from('places').upsert(row, { onConflict: 'id' })
    : await supabase.from('places').insert(row);
  if (res.error) throw res.error;
  notifyLocalChange('places');
}

export async function deletePlace(id: string) {
  const res = await supabase.from('places').delete().eq('id', id);
  if (res.error) throw res.error;
  notifyLocalChange('places');
}

/* -------------------------------------------------------------------- chat */

const toMessage = (r: any): MessageDoc => ({
  id: r.id,
  senderId: r.sender_id,
  senderName: r.sender_name,
  senderRole: r.sender_role,
  text: r.text,
  createdAt: date(r.created_at),
});

export const PAGE = 150;

export async function fetchGroupMessages() {
  const rows = must(await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(PAGE));
  return (rows ?? []).map(toMessage);
}

export async function fetchLatestGroupMessage() {
  const rows = must(await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(1));
  return rows && rows.length > 0 ? toMessage(rows[0]) : null;
}

export async function fetchDmMessages(threadId: string) {
  const rows = must(
    await supabase.from('dm_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: false }).limit(PAGE)
  );
  return (rows ?? []).map(toMessage);
}

/** The sender's name and role are filled in by the database from the signed-in profile. */
export async function sendGroupMessage(text: string) {
  const res = await supabase.from('messages').insert({ text });
  if (res.error) throw res.error;
  notifyLocalChange('messages');
}

export async function sendDirectMessage(input: { staffId: string; consultantId: string; text: string }) {
  const res = await supabase.rpc('send_direct_message', {
    p_staff_id: input.staffId,
    p_consultant_id: input.consultantId,
    p_text: input.text,
  });
  if (res.error) throw res.error;
  notifyLocalChange('dm_messages', 'dm_threads');
}

const toThread = (r: any): DmThreadDoc => ({
  id: r.id,
  participants: [r.staff_id, r.consultant_id],
  staffId: r.staff_id,
  staffName: r.staff_name,
  consultantId: r.consultant_id,
  consultantName: r.consultant_name,
  lastMessage: r.last_message ?? '',
  lastMessageAt: date(r.last_message_at),
  lastSenderId: r.last_sender_id ?? '',
});

/** Row-level security already limits this to the threads the signed-in person takes part in. */
export async function fetchDmThreads() {
  const rows = must(await supabase.from('dm_threads').select('*'));
  return (rows ?? []).map(toThread);
}

export async function dmThreadExists(threadId: string) {
  const r = must(await supabase.from('dm_threads').select('id').eq('id', threadId).maybeSingle());
  return Boolean(r);
}

export async function fetchChatLock() {
  const r: any = must(await supabase.from('chat_meta').select('locked').eq('id', 'group').maybeSingle());
  return Boolean(r?.locked);
}

export async function saveChatLock(locked: boolean, byUid: string) {
  const res = await supabase
    .from('chat_meta')
    .upsert({ id: 'group', locked, locked_by: byUid, locked_at: new Date().toISOString() }, { onConflict: 'id' });
  if (res.error) throw res.error;
  notifyLocalChange('chat_meta');
}

/* ------------------------------------------------------------ notifications */

const toNotification = (r: any): NotificationDoc => ({
  id: r.id,
  type: r.type,
  text: r.text,
  read: Boolean(r.read),
  createdAt: date(r.created_at),
  ...(r.broadcast_id ? { broadcastId: r.broadcast_id } : {}),
});

export async function fetchNotifications(uid: string) {
  const rows = must(
    await supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(100)
  );
  return (rows ?? []).map(toNotification);
}

export async function markNotificationRead(id: string) {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
  notifyLocalChange('notifications');
}

interface NotifyOptions {
  /** Same id for every recipient, so staff can later check who has read it. */
  broadcastId?: string;
}

export async function notifyUsers(userIds: string[], type: NotificationType, text: string, options: NotifyOptions = {}) {
  if (userIds.length === 0) return;
  const rows = userIds.map((uid) => ({
    user_id: uid,
    type,
    text,
    read: false,
    ...(options.broadcastId ? { broadcast_id: options.broadcastId } : {}),
  }));
  const res = await supabase.from('notifications').insert(rows);
  if (res.error) throw res.error;
  notifyLocalChange('notifications');
}

export async function createBroadcast(input: { id: string; text: string; audience: string[]; createdBy: string }) {
  const res = await supabase
    .from('broadcasts')
    .insert({ id: input.id, text: input.text, audience: input.audience, created_by: input.createdBy });
  if (res.error) throw res.error;
  notifyLocalChange('broadcasts');
}

const toBroadcast = (r: any): BroadcastDoc => ({
  id: r.id,
  text: r.text,
  audience: r.audience ?? [],
  createdBy: r.created_by ?? '',
  createdAt: date(r.created_at),
});

export async function fetchRecentBroadcasts(count: number) {
  const rows = must(await supabase.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(count));
  return (rows ?? []).map(toBroadcast);
}

/** Each recipient's alert shares the announcement's id: "who has read it" is a single query. */
export async function readReceipts(broadcast: BroadcastDoc) {
  const res = await supabase.from('notifications').select('user_id, read').eq('broadcast_id', broadcast.id);
  const rows = (res.error ? [] : res.data) as { user_id: string; read: boolean }[];
  const readBy = new Set(rows.filter((r) => r.read).map((r) => r.user_id));
  return {
    read: broadcast.audience.filter((uid) => readBy.has(uid)),
    unread: broadcast.audience.filter((uid) => !readBy.has(uid)),
  };
}

/* --------------------------------------------------------------- roll-calls */

const toCheckin = (r: any): CheckinDoc => ({
  id: r.id,
  title: r.title,
  closed: Boolean(r.closed),
  createdBy: r.created_by ?? '',
  createdAt: date(r.created_at),
});

export async function fetchLatestCheckin() {
  const rows = must(await supabase.from('checkins').select('*').order('created_at', { ascending: false }).limit(1));
  return rows && rows.length > 0 ? toCheckin(rows[0]) : null;
}

export async function hasAnsweredCheckin(checkinId: string, uid: string) {
  const r = must(await supabase.from('checkin_responses').select('uid').eq('checkin_id', checkinId).eq('uid', uid).maybeSingle());
  return Boolean(r);
}

export async function fetchCheckinResponses(checkinId: string): Promise<CheckinResponseDoc[]> {
  const rows = must(await supabase.from('checkin_responses').select('*').eq('checkin_id', checkinId));
  return (rows ?? []).map((r: any) => ({ uid: r.uid, name: r.name, at: date(r.at) }));
}

export async function openCheckin(title: string, staffUid: string) {
  const r: any = must(await supabase.from('checkins').insert({ title, created_by: staffUid }).select('id').single());
  notifyLocalChange('checkins');
  return r.id as string;
}

export async function closeCheckin(checkinId: string) {
  const res = await supabase.from('checkins').update({ closed: true }).eq('id', checkinId);
  if (res.error) throw res.error;
  notifyLocalChange('checkins');
}

export async function answerCheckin(checkinId: string, uid: string, name: string) {
  const res = await supabase.from('checkin_responses').upsert({ checkin_id: checkinId, uid, name }, { onConflict: 'checkin_id,uid' });
  if (res.error) throw res.error;
  notifyLocalChange('checkin_responses');
}

/* ----------------------------------------------------------- help requests */

const toHelp = (r: any): HelpRequestDoc => ({
  id: r.id,
  uid: r.uid,
  name: r.name,
  phone: r.phone ?? '',
  ...(r.lat != null ? { lat: r.lat } : {}),
  ...(r.lng != null ? { lng: r.lng } : {}),
  ...(r.message ? { message: r.message } : {}),
  status: r.status,
  createdAt: date(r.created_at),
});

export async function fetchOpenHelpRequests() {
  const rows = must(await supabase.from('help_requests').select('*').eq('status', 'open').order('created_at', { ascending: false }));
  return (rows ?? []).map(toHelp);
}

export async function createHelpRequest(input: { uid: string; name: string; phone: string; lat?: number; lng?: number; message?: string }) {
  const res = await supabase.from('help_requests').insert({
    uid: input.uid,
    name: input.name,
    phone: input.phone,
    status: 'open',
    lat: typeof input.lat === 'number' ? input.lat : null,
    lng: typeof input.lng === 'number' ? input.lng : null,
    message: input.message || null,
  });
  if (res.error) throw res.error;
  notifyLocalChange('help_requests');
}

export async function resolveHelpRequest(id: string) {
  const res = await supabase.from('help_requests').update({ status: 'resolved' }).eq('id', id);
  if (res.error) throw res.error;
  notifyLocalChange('help_requests');
}
