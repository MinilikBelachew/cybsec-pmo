import { buildProjectWhere } from './record-scope.where';
import type { CaslUserContext, PermissionRow } from './casl.types';

const pmUser: CaslUserContext = {
  id: 'pm-user-1',
  roleId: 4,
  roleCode: 'pm',
};

const pmoUser: CaslUserContext = {
  id: 'pmo-user-1',
  roleId: 3,
  roleCode: 'pmo_lead',
};

describe('dashboard project record scope', () => {
  it('PM own_projects scopes dashboard projects to primary/secondary PM', () => {
    const permissions: PermissionRow[] = [
      {
        module: 'projects',
        action: 'view',
        recordScope: 'own_projects',
        fieldScope: null,
      },
    ];

    expect(buildProjectWhere(permissions, pmUser, 'read')).toEqual({
      OR: [{ primaryPmId: pmUser.id }, { secondaryPmId: pmUser.id }],
    });
  });

  it('PMO Lead all scope allows cross-project dashboard visibility', () => {
    const permissions: PermissionRow[] = [
      {
        module: 'projects',
        action: 'view',
        recordScope: 'all',
        fieldScope: null,
      },
    ];

    expect(buildProjectWhere(permissions, pmoUser, 'read')).toEqual({});
  });
});
