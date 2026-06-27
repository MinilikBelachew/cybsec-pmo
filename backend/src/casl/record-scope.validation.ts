import {
  isKnownRecordScope,
  RECORD_SCOPE_CODES,
} from './record-scope.registry';

export class UnknownRecordScopeError extends Error {
  constructor(public readonly unknownScopes: string[]) {
    super(
      `Unknown record_scope value(s): ${unknownScopes.join(', ')}. ` +
        `Allowed: ${RECORD_SCOPE_CODES.join(', ')}`,
    );
    this.name = 'UnknownRecordScopeError';
  }
}

export function findUnknownRecordScopes(
  scopes: Iterable<string | null | undefined>,
): string[] {
  const unknown = new Set<string>();

  for (const scope of scopes) {
    if (scope == null || scope === '') {
      continue;
    }
    if (!isKnownRecordScope(scope)) {
      unknown.add(scope);
    }
  }

  return [...unknown].sort();
}

export function assertKnownRecordScopes(
  scopes: Iterable<string | null | undefined>,
): void {
  const unknown = findUnknownRecordScopes(scopes);
  if (unknown.length > 0) {
    throw new UnknownRecordScopeError(unknown);
  }
}
