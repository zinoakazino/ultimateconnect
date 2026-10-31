export type Role = 'staff' | 'consultant';

/** Dates come from the database as ISO strings; the app works with `Date`s (or null while unknown). */
export type Ts = Date | null;

export interface UserLocation {
  lat: number;
  lng: number;
  updatedAt: Ts;
}

export interface UserDoc {
  uid: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
  verified: boolean;
  /** Consultant opt-in toggle. Staff only see `location` while this is true. */
  locationSharing: boolean;
  location?: UserLocation;
  /** The travel group (1, 2…) this person flies with — null while staff have not set it. */
  groupId: number | null;
  lastActive: Ts;
  createdAt: Ts;
}

/**
 * One of the trip's groups: same days, but its own flights. Times are LOCAL "HH:MM" strings
 * (Algiers when leaving Algiers, Istanbul when leaving Istanbul); dates are "YYYY-MM-DD".
 */
export interface TripGroupDoc {
  id: number;
  name: string;
  airline: string;
  outDate: string;
  outFrom: string;
  outTo: string;
  outDep: string;
  outArr: string;
  backDate: string;
  backFrom: string;
  backTo: string;
  backDep: string;
  backArr: string;
  /** Meeting time at Algiers airport. */
  meetTime: string | null;
  meetPlace: string;
  /** Weight of EACH checked bag. */
  bagHoldKg: number | null;
  /** How many checked bags (2 = "23 kg x 2"). */
  bagHoldCount: number;
  bagCabinKg: number | null;
  /** Thursday, approximate. */
  hotelArrival: string | null;
  /** Monday check-out deadline; null = staff will announce it. */
  checkoutBy: string | null;
  note: string;
  /** The meeting-place and note texts in Arabic ('' = none: the French ones are shown). */
  meetPlaceAr: string;
  noteAr: string;
}

/** A person staff expect on the trip, prepared in advance. They take their name when they sign up. */
export interface RosterEntry {
  id: string;
  name: string;
  role: Role;
  groupId: number | null;
  /** The account that took this name (null = not signed up yet). */
  profileUid: string | null;
}

/** What the sign-up screen may show a visitor who knows the invite code: the names still free. */
export interface RosterChoice {
  id: string;
  name: string;
  groupId: number | null;
}

export interface TripDoc {
  name: string;
  /** The name in Arabic ('' = none: the French one is shown). */
  nameAr: string;
  startDate: Date;
  endDate: Date;
}

export interface ScheduleItem {
  id: string;
  time: string;
  title: string;
  /** The line in Arabic: shown instead of `title` when the app is in Arabic (missing = the French one is shown). */
  titleAr?: string;
  important: boolean;
  createdBy: string;
  /** Only this travel group sees the line (flights, hotel arrival…). Missing = everybody. */
  group?: number;
}

export interface ScheduleDoc {
  date: string;
  items: ScheduleItem[];
  updatedAt: Ts;
}

export interface MessageDoc {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  text: string;
  createdAt: Ts;
}

/** 1:1 thread between one staff member and one consultant. Id: `<staffUid>_<consultantUid>`. */
export interface DmThreadDoc {
  id: string;
  participants: string[];
  staffId: string;
  staffName: string;
  consultantId: string;
  consultantName: string;
  lastMessage: string;
  lastMessageAt: Ts;
  lastSenderId: string;
}

export function dmThreadId(staffUid: string, consultantUid: string) {
  return `${staffUid}_${consultantUid}`;
}

export type NotificationType =
  | 'reminder'
  | 'chat'
  | 'schedule'
  | 'broadcast'
  | 'verification'
  | 'checkin';

export interface NotificationDoc {
  id: string;
  type: NotificationType;
  text: string;
  createdAt: Ts;
  read: boolean;
  broadcastId?: string;
}

/** A record of an announcement staff sent, used to show who has read it. */
export interface BroadcastDoc {
  id: string;
  text: string;
  audience: string[];
  createdBy: string;
  createdAt: Ts;
}

export type PlaceCategory =
  | 'emergency'
  | 'group'
  | 'recommended'
  | 'restaurant'
  | 'shopping'
  | 'tool'
  | 'info';

export interface PlaceDoc {
  id: string;
  category: PlaceCategory;
  name: string;
  description: string;
  /** The same two texts in Arabic ('' = none: the French ones are shown). */
  nameAr: string;
  descriptionAr: string;
  address?: string;
  phone?: string;
  lat?: number;
  lng?: number;
}

export interface CheckinDoc {
  id: string;
  title: string;
  closed: boolean;
  createdBy: string;
  createdAt: Ts;
}

export interface CheckinResponseDoc {
  uid: string;
  name: string;
  at: Ts;
}

export interface HelpRequestDoc {
  id: string;
  uid: string;
  name: string;
  phone: string;
  lat?: number;
  lng?: number;
  message?: string;
  status: 'open' | 'resolved';
  createdAt: Ts;
}
