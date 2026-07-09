import {
  KEKA_EMPLOYMENT_STATUS_RELIEVED,
  KEKA_EMPLOYMENT_STATUS_WORKING,
  KEKA_GROUP_TYPE_BENEFIT,
  KEKA_GROUP_TYPE_DEPARTMENT,
  KEKA_GROUP_TYPE_LEAVE_ENCASHMENT,
  KEKA_GROUP_TYPE_LEGAL_ENTITY,
  KEKA_GROUP_TYPE_LOCATION,
  KekaEmployeeLookup,
  KekaEmployeeProfile,
  KekaLookupInfo,
} from '../keka.types';
import {
  KEKA_MOCK_BENEFIT_GROUP,
  KEKA_MOCK_LEAVE_ENCASHMENT_GROUP,
  KEKA_MOCK_LEGAL_ENTITY,
  KEKA_MOCK_LOCATION,
} from './keka-mock.ids';

const JOINED_AT = '2024-01-15T00:00:00.000Z';
const PROBATION_END = '2025-01-15T00:00:00.000Z';
const DOB = '1990-01-15T00:00:00.000Z';

const EMPTY_MANAGER: KekaEmployeeLookup = {
  id: null,
  firstName: null,
  lastName: null,
  email: null,
};

const DEFAULT_CUSTOM_FIELDS = [
  {
    id: '2f1f2bd4-368c-4b3e-bd8c-7d952c9e761b',
    title: 'Custom Field',
    type: 'MultiDropdown',
    value: null,
  },
  {
    id: 'c82399d3-db19-47a8-a213-542fc5629bf9',
    title: '[New Field]',
    type: 'TextBox',
    value: null,
  },
  {
    id: '39217c59-24a2-4dda-98e6-b90b0f69c27a',
    title: 'ATTENDANCE NUMBER',
    type: 'TextBox',
    value: null,
  },
] as const;

const DEFAULT_POLICIES = {
  leavePlanInfo: {
    identifier: '6bf450ff-2c9b-42e4-9715-4a1a626a1857',
    title: 'Leave',
  },
  shiftPolicyInfo: {
    identifier: 'e832b29d-9670-4c41-8929-35a8c5d99551',
    title: 'General Shift',
  },
  weeklyOffPolicyInfo: {
    identifier: '3d7e5863-5968-49da-be53-51623a8c47c8',
    title: "General Weekly off's",
  },
  captureSchemeInfo: {
    identifier: '250df970-5c77-4fda-90cd-a5445b321aab',
    title: 'AWE',
  },
  expensePolicyInfo: {
    identifier: '9bdeaea2-4727-4453-a901-0b41d1714272',
    title: 'Sr. Policy',
  },
} as const;

function managerLookup(
  id: string,
  firstName: string,
  lastName: string,
  email: string,
): KekaEmployeeLookup {
  return { id, firstName, lastName, email };
}

function mockProfileImage(displayName: string) {
  const encodedName = encodeURIComponent(displayName);
  return {
    fileName: null,
    thumbs: {
      '48': `https://ui-avatars.com/api/?name=${encodedName}&size=48&background=0f172a&color=ffffff`,
      '200': `https://ui-avatars.com/api/?name=${encodedName}&size=200&background=0f172a&color=ffffff`,
    },
  };
}

export type MockEmployeeInput = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  jobTitle: KekaLookupInfo;
  departmentId: string;
  departmentTitle: string;
  reportsTo?: KekaEmployeeLookup | null;
  l2Manager?: KekaEmployeeLookup | null;
  employmentStatus?: number;
  accountStatus?: number;
  exitDate?: string | null;
  mobilePhone?: string;
  attendanceNumber?: string;
  timeType?: number;
  workerType?: number;
};

export function buildKekaMockEmployee(input: MockEmployeeInput): KekaEmployeeProfile {
  const displayName = input.displayName.trim();

  return {
    id: input.id,
    employeeNumber: input.employeeNumber,
    firstName: input.firstName,
    middleName: null,
    lastName: input.lastName,
    displayName,
    email: input.email,
    city: KEKA_MOCK_LOCATION.title,
    countryCode: 'ET',
    image: mockProfileImage(displayName),
    jobTitle: input.jobTitle,
    secondaryJobTitle: null,
    reportsTo: input.reportsTo ?? null,
    l2Manager: input.l2Manager ?? null,
    dottedLineManager: EMPTY_MANAGER,
    contingentType: {
      id: '51E6875B-2E54-42E8-9794-87B675584F80',
      name: 'Permanent',
    },
    timeType: input.timeType ?? 1,
    workerType: input.workerType ?? 2,
    isPrivate: false,
    isProfileComplete: true,
    maritalStatus: 0,
    marriageDate: null,
    gender: 1,
    joiningDate: JOINED_AT,
    professionalSummary: null,
    dateOfBirth: DOB,
    resignationSubmittedDate: null,
    exitDate: input.exitDate ?? null,
    employmentStatus: input.employmentStatus ?? KEKA_EMPLOYMENT_STATUS_WORKING,
    accountStatus: input.accountStatus ?? 1,
    invitationStatus: 1,
    exitStatus: 0,
    exitType: 0,
    exitReason: null,
    personalEmail: null,
    workPhone: null,
    homePhone: null,
    mobilePhone: input.mobilePhone ?? '+251900000000',
    bloodGroup: 0,
    attendanceNumber: input.attendanceNumber ?? `ATT-${input.employeeNumber}`,
    probationEndDate: PROBATION_END,
    currentAddress: null,
    permanentAddress: null,
    relations: [],
    educationDetails: [],
    experienceDetails: [],
    customFields: [...DEFAULT_CUSTOM_FIELDS],
    groups: [
      {
        id: KEKA_MOCK_LEGAL_ENTITY.id,
        title: KEKA_MOCK_LEGAL_ENTITY.title,
        groupType: KEKA_GROUP_TYPE_LEGAL_ENTITY,
      },
      {
        id: input.departmentId,
        title: input.departmentTitle,
        groupType: KEKA_GROUP_TYPE_DEPARTMENT,
      },
      {
        id: KEKA_MOCK_LOCATION.id,
        title: KEKA_MOCK_LOCATION.title,
        groupType: KEKA_GROUP_TYPE_LOCATION,
      },
      {
        id: KEKA_MOCK_BENEFIT_GROUP.id,
        title: KEKA_MOCK_BENEFIT_GROUP.title,
        groupType: KEKA_GROUP_TYPE_BENEFIT,
      },
      {
        id: KEKA_MOCK_LEAVE_ENCASHMENT_GROUP.id,
        title: KEKA_MOCK_LEAVE_ENCASHMENT_GROUP.title,
        groupType: KEKA_GROUP_TYPE_LEAVE_ENCASHMENT,
      },
    ],
    ...DEFAULT_POLICIES,
    bandInfo: null,
    payGradeInfo: null,
    trackingPolicyInfo: null,
    overtimePolicyInfo: null,
  };
}

export function buildRelievedEmployee(input: MockEmployeeInput): KekaEmployeeProfile {
  return buildKekaMockEmployee({
    ...input,
    employmentStatus: KEKA_EMPLOYMENT_STATUS_RELIEVED,
    exitDate: '2025-12-31T00:00:00.000Z',
    accountStatus: 0,
  });
}

export { managerLookup };
