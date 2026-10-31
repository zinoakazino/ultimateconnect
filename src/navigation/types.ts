export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

/** Everything a 1:1 thread screen needs, so it can open before the thread exists. */
export interface DmThreadParams {
  threadId: string;
  /** Name of the other person, shown in the header. */
  title: string;
  staffId: string;
  staffName: string;
  consultantId: string;
  consultantName: string;
}

export type ConsultantTabParamList = {
  Home: undefined;
  Map: undefined;
  Chat: undefined;
  Alerts: undefined;
  Profile: undefined;
};

export type ConsultantStackParamList = {
  ConsultantTabs: undefined;
  TripGuide: undefined;
  TripSchedule: undefined;
  DmInbox: undefined;
  DmThread: DmThreadParams;
  Emergency: undefined;
};

export type StaffTabParamList = {
  Schedule: undefined;
  Consultants: undefined;
  Chat: undefined;
  Broadcast: undefined;
  Profile: undefined;
};

export type StaffStackParamList = {
  StaffTabs: undefined;
  DmThread: DmThreadParams;
  ManageTrip: undefined;
  PlaceEditor: { placeId?: string } | undefined;
  IstanbulMap: undefined;
  Emergency: undefined;
};
