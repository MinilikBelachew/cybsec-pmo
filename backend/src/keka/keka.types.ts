/** Keka API envelope — https://developers.keka.com/reference/get_hris-employees */
export type KekaTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type KekaPagedResponse<T> = {
  succeeded: boolean;
  message?: string | null;
  errors?: string[] | null;
  data: T[];
  pageNumber: number;
  pageSize: number;
  firstPage?: string | null;
  lastPage?: string | null;
  totalPages: number;
  totalRecords: number;
  nextPage?: string | null;
  previousPage?: string | null;
};

export type KekaLookupInfo = {
  identifier?: string | null;
  title?: string | null;
};

export type KekaEmployeeLookup = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

export type KekaProfileImage = {
  fileName?: string | null;
  thumbs?: Record<string, string | null> | null;
};

export type KekaGroupLookup = {
  id?: string | null;
  title?: string | null;
  groupType?: number | null;
};

export type KekaContingentType = {
  id?: string | null;
  name?: string | null;
};

export type KekaCustomField = {
  id?: string | null;
  title?: string | null;
  type?: string | null;
  value?: string | null;
};

export type KekaEmployeeProfile = {
  id?: string | null;
  employeeNumber?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
  city?: string | null;
  countryCode?: string | null;
  image?: KekaProfileImage | null;
  jobTitle?: KekaLookupInfo | null;
  secondaryJobTitle?: string | null;
  reportsTo?: KekaEmployeeLookup | null;
  l2Manager?: KekaEmployeeLookup | null;
  dottedLineManager?: KekaEmployeeLookup | null;
  contingentType?: KekaContingentType | null;
  timeType?: number | null;
  workerType?: number | null;
  isPrivate?: boolean | null;
  isProfileComplete?: boolean | null;
  maritalStatus?: number | null;
  marriageDate?: string | null;
  gender?: number | null;
  joiningDate?: string | null;
  professionalSummary?: string | null;
  dateOfBirth?: string | null;
  resignationSubmittedDate?: string | null;
  exitDate?: string | null;
  employmentStatus?: number | null;
  accountStatus?: number | null;
  invitationStatus?: number | null;
  exitStatus?: number | null;
  exitType?: number | null;
  exitReason?: string | null;
  personalEmail?: string | null;
  workPhone?: string | null;
  homePhone?: string | null;
  mobilePhone?: string | null;
  bloodGroup?: number | null;
  attendanceNumber?: string | null;
  probationEndDate?: string | null;
  currentAddress?: unknown | null;
  permanentAddress?: unknown | null;
  relations?: unknown[] | null;
  educationDetails?: unknown[] | null;
  experienceDetails?: unknown[] | null;
  customFields?: KekaCustomField[] | null;
  groups?: KekaGroupLookup[] | null;
  leavePlanInfo?: KekaLookupInfo | null;
  bandInfo?: KekaLookupInfo | null;
  payGradeInfo?: KekaLookupInfo | null;
  shiftPolicyInfo?: KekaLookupInfo | null;
  weeklyOffPolicyInfo?: KekaLookupInfo | null;
  captureSchemeInfo?: KekaLookupInfo | null;
  trackingPolicyInfo?: KekaLookupInfo | null;
  expensePolicyInfo?: KekaLookupInfo | null;
  overtimePolicyInfo?: KekaLookupInfo | null;
};

/** Keka department — https://developers.keka.com/reference/get_hris-departments */
export type KekaDepartment = {
  id?: string | null;
  parentId?: string | null;
  name?: string | null;
  description?: string | null;
  isArchived?: boolean;
  departmentHeads?: KekaEmployeeLookup[] | null;
};

/** Leave — https://developers.keka.com/reference/get_time-leaverequests */
export enum KekaLeaveRequestStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  Cancelled = 3,
  InApprovalProcess = 4,
}

export enum KekaSessionType {
  FirstHalf = 0,
  SecondHalf = 1,
}

export type KekaLeaveTypeSelection = {
  leaveTypeIdentifier?: string | null;
  leaveTypeName?: string | null;
  count?: number | null;
};

export type KekaLeaveRequest = {
  id?: string | null;
  employeeIdentifier?: string | null;
  employeeNumber?: string | null;
  fromDate: string;
  toDate: string;
  fromSession?: KekaSessionType | null;
  toSession?: KekaSessionType | null;
  requestedOn?: string | null;
  note?: string | null;
  cancelRejectReason?: string | null;
  status?: KekaLeaveRequestStatus | null;
  selection?: KekaLeaveTypeSelection[] | null;
  lastActionTakenOn?: string | null;
};

export type KekaTimeEntryPayload = {
  projectId: string;
  taskId?: string;
  date: string;
  minutes: number;
  notes?: string;
};

export type KekaSyncJobResult = {
  entityType: string;
  synced: number;
  failed: number;
  employeeIds?: string[];
};

export type KekaSyncRunResult = {
  startedAt: string;
  completedAt: string;
  results: KekaSyncJobResult[];
};

/** Keka SystemGroupType values (tenant-standard; department = 2 per live API). */
export const KEKA_GROUP_TYPE_LEGAL_ENTITY = 1;
export const KEKA_GROUP_TYPE_DEPARTMENT = 2;
export const KEKA_GROUP_TYPE_LOCATION = 3;
export const KEKA_GROUP_TYPE_BENEFIT = 5;
export const KEKA_GROUP_TYPE_LEAVE_ENCASHMENT = 9;

/** Keka EmploymentStatus — 0 working, 1 relieved. */
export const KEKA_EMPLOYMENT_STATUS_WORKING = 0;
export const KEKA_EMPLOYMENT_STATUS_RELIEVED = 1;
