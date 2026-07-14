/** Stable UUIDs shared by mock fixtures and database seed. */

export const KEKA_MOCK_LEGAL_ENTITY = {
  id: 'db76d978-8722-4e9a-9415-94f5bb523810',
  title: 'Cybsec Consulting',
} as const;

export const KEKA_MOCK_LOCATION = {
  id: '93aca2bc-1c6f-45de-98e3-047f3d07d718',
  title: 'Addis Ababa',
} as const;

export const KEKA_MOCK_BENEFIT_GROUP = {
  id: 'a133a9ca-0876-4bb0-b90b-aa13a2fc39bd',
  title: 'Flexi Benefit Plan',
} as const;

export const KEKA_MOCK_LEAVE_ENCASHMENT_GROUP = {
  id: '9873b4ee-097a-43d7-b55c-7663fd989387',
  title: 'LE',
} as const;

export const KEKA_MOCK_DEPARTMENTS = [
  {
    id: '5d33beac-c915-481f-b539-c1e9c12d111e',
    code: 'SOC',
    name: 'Security Operations Center',
    description: 'SOC delivery and monitoring',
  },
  {
    id: 'a1111111-1111-4111-8111-111111111101',
    code: 'GRC',
    name: 'Governance, Risk & Compliance',
    description: 'GRC advisory and compliance',
  },
  {
    id: 'a1111111-1111-4111-8111-111111111102',
    code: 'CLOUD',
    name: 'Cloud Security',
    description: 'Cloud security engineering',
  },
  {
    id: 'a1111111-1111-4111-8111-111111111103',
    code: 'APPSEC',
    name: 'Application Security',
    description: 'Application security assessments',
  },
  {
    id: 'a1111111-1111-4111-8111-111111111104',
    code: 'PENTEST',
    name: 'Penetration Testing',
    description: 'Offensive security testing',
  },
  {
    id: 'a1111111-1111-4111-8111-111111111105',
    code: 'IR',
    name: 'Incident Response',
    description: 'Incident response and forensics',
  },
  {
    id: 'a1111111-1111-4111-8111-111111111106',
    code: 'ARCH',
    name: 'Security Architecture',
    description: 'Enterprise security architecture',
  },
  {
    id: 'a1111111-1111-4111-8111-111111111107',
    code: 'IAM',
    name: 'Identity & Access Management',
    description: 'IAM design and operations',
  },
  {
    id: 'a1111111-1111-4111-8111-111111111108',
    code: 'COMPLIANCE',
    name: 'Compliance Advisory',
    description: 'Regulatory compliance consulting',
  },
  {
    id: 'a1111111-1111-4111-8111-111111111109',
    code: 'LEADERSHIP',
    name: 'Security Leadership',
    description: 'Practice leadership and management',
  },
] as const;

export const KEKA_MOCK_EMPLOYEE_IDS = {
  rachel: '6b153a31-7017-47f3-ba01-4f8a9257b5f1',
  brian: '39663c6a-d8d6-49e2-aabd-a366a66fb2c2',
  emily: 'c5e1a9ee-3753-4a32-aaa1-0a31c5d30c74',
  sarah: 'b2222222-2222-4222-8222-222222222201',
  james: 'b2222222-2222-4222-8222-222222222202',
  priya: 'b2222222-2222-4222-8222-222222222203',
  michael: 'b2222222-2222-4222-8222-222222222204',
  anna: 'b2222222-2222-4222-8222-222222222205',
  david: 'b2222222-2222-4222-8222-222222222206',
  tom: 'b2222222-2222-4222-8222-222222222207',
} as const;

export const KEKA_MOCK_JOB_TITLE_IDS = {
  teamLead: '99b581e2-3933-4534-bfd5-2e53aac4f4cb',
  securityConsultant: 'f1a2b3c4-1111-4111-8111-111111111001',
  grcAnalyst: 'f1a2b3c4-1111-4111-8111-111111111002',
  cloudEngineer: 'f1a2b3c4-1111-4111-8111-111111111003',
  pentester: 'f1a2b3c4-1111-4111-8111-111111111004',
  appsecEngineer: 'f1a2b3c4-1111-4111-8111-111111111005',
  irAnalyst: 'f1a2b3c4-1111-4111-8111-111111111006',
  architect: 'f1a2b3c4-1111-4111-8111-111111111007',
  iamSpecialist: 'f1a2b3c4-1111-4111-8111-111111111008',
  complianceAdvisor: 'f1a2b3c4-1111-4111-8111-111111111009',
} as const;
