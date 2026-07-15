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

/** Attendance — https://developers.keka.com/reference/get_time-attendance-1 */
export enum KekaAttendanceDayType {
  WorkingDay = 0,
  Holiday = 1,
  WeeklyOff = 2,
  Leave = 3,
  Unknown = 4,
}

export type KekaAttendanceTimeEntry = {
  timestamp: string;
  employeeIdentifier?: string;
  punchStatus?: number;
  attendanceLogSource?: number;
  manualClockinType?: number;
  premiseName?: string | null;
  locationAddress?: Record<string, string | null> | null;
};

export type KekaAttendanceSummary = {
  id?: string | null;
  employeeNumber?: string | null;
  employeeIdentifier?: string | null;
  attendanceDate: string;
  dayType?: KekaAttendanceDayType | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  shiftDuration?: number | null;
  shiftBreakDuration?: number | null;
  shiftEffectiveDuration?: number | null;
  totalGrossHours?: number | null;
  totalEffectiveHours?: number | null;
  totalBreakDuration?: number | null;
  totalEffectiveOvertimeDuration?: number | null;
  totalGrossOvertimeDuration?: number | null;
  firstInOfTheDay?: KekaAttendanceTimeEntry | null;
  lastOutOfTheDay?: KekaAttendanceTimeEntry | null;
};

/** Holiday calendar — https://developers.keka.com/reference/get_time-holidayscalendar */
export type KekaHolidayCalendar = {
  id?: string | null;
  name?: string | null;
};

/** Holiday — https://developers.keka.com/reference/get_time-holidayscalendar-calendarid-holidays */
export type KekaHoliday = {
  id: string;
  name?: string | null;
  date: string;
  isFloater: boolean;
};

export type KekaTimeEntryPayload = {
  projectId: string;
  taskId?: string;
  date: string;
  minutes: number;
  notes?: string;
};

/** GET /psa/timeentries — https://developers.keka.com/reference/get_psa-timeentries */
export type KekaPsaTimesheetEntry = {
  id?: string | null;
  date: string;
  employeeId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  totalMinutes?: number | null;
  comments?: string | null;
  isBillable?: boolean | null;
  status?: number | null;
};

/** PSA client — https://developers.keka.com/reference/get_psa-clients-1 */
export type KekaPsaClientAddress = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  countryCode?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export type KekaPsaClientContact = {
  id?: string | null;
  clientId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type KekaPsaClient = {
  id?: string | null;
  name?: string | null;
  billingName?: string | null;
  code?: string | null;
  description?: string | null;
  billingAddress?: KekaPsaClientAddress | null;
  clientContacts?: KekaPsaClientContact[] | null;
};

/** Body for POST /psa/clients — required: name, code */
export type KekaCreateClientPayload = {
  name: string;
  code: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
};

/** PSA project — https://developers.keka.com/reference/get_psa-projects-1 */
export type KekaPsaProject = {
  id?: string | null;
  clientId?: string | null;
  name?: string | null;
  code?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: number | null;
  isBillable?: boolean | null;
  billingType?: number | null;
  projectBudget?: number | null;
  budgetedTime?: number | null;
  isArchived?: boolean | null;
};

/** PSA task — https://developers.keka.com/reference/get_psa-projects-projectid-tasks-1 */
export type KekaPsaTask = {
  id?: string | null;
  projectId?: string | null;
  name?: string | null;
  description?: string | null;
  taskType?: number | null;
  taskBillingType?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  estimatedHours?: number | null;
};

/** PSA billing role — GET /psa/clients/{id}/billingroles */
export type KekaBillingRole = {
  id?: string | null;
  name?: string | null;
  billingRate?: {
    unit?: number | null;
    rate?: number | null;
  } | null;
};

/** Salary — https://developers.keka.com/reference/get_payroll-salaries */
export type KekaEmployeeSalaryLookup = {
  id?: string | null;
  employeeNumber?: string | null;
  employeeName?: string | null;
};

export type KekaSalaryComponent = {
  id: string;
  title?: string | null;
  amount: number;
  isOutsideCTC: boolean;
};

export type KekaSalaryVariableComponent = {
  id: string;
  title?: string | null;
  amount: number;
  payoutDate: string;
};

export type KekaEmployeeSalary = {
  id?: string | null;
  employee?: KekaEmployeeSalaryLookup | null;
  ctc: number;
  gross: number;
  netPay: number;
  remunerationType?: number | null;
  effectiveFrom: string;
  earnings?: KekaSalaryComponent[] | null;
  contributions?: KekaSalaryComponent[] | null;
  deductions?: KekaSalaryComponent[] | null;
  variables?: KekaSalaryVariableComponent[] | null;
};

/** Pay group — https://developers.keka.com/reference/get_payroll-paygroups-1 */
export type KekaPayGroup = {
  id?: number | null;
  identifier?: string | null;
  name?: string | null;
  description?: string | null;
  legalEntityId?: string | null;
  legalEntityName?: string | null;
};

/** Pay cycle — https://developers.keka.com/reference/get_payroll-paygroups-paycycles */
export enum KekaPayrollRunStatus {
  Pending = 0,
  Finalized = 1,
  Partial = 2,
}

export type KekaPayCycle = {
  identifier?: string | null;
  month?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  runStatus?: KekaPayrollRunStatus | null;
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
