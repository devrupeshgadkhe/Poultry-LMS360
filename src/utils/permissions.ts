/**
 * Role-Based Access Control (RBAC) & Granular Claims Engine
 * Controls operator permissions across Web and Android / Capacitor builds.
 */

export function getUserRole(): string {
  return localStorage.getItem('userRole') || '';
}

export function getUserPermissions(): string {
  const saved = localStorage.getItem('userPermissions');
  if (saved !== null && saved !== undefined) {
    return saved.trim().toLowerCase();
  }
  
  // Fallback: extract from token if available
  const tok = localStorage.getItem('token');
  if (tok) {
    try {
      const payload = JSON.parse(atob(tok));
      if (payload.Permissions) {
        localStorage.setItem('userPermissions', payload.Permissions);
        return String(payload.Permissions).trim().toLowerCase();
      }
    } catch {}
  }
  return '';
}

export function isSuperOrAdmin(): boolean {
  const role = getUserRole();
  const perms = getUserPermissions();
  return (
    role === 'Developer' ||
    role === 'Admin' ||
    perms === 'all' ||
    perms.includes('admin')
  );
}

/**
 * Checks whether the current session has the given permission claim.
 * SuperAdmin / Developer and Farm Admin always have all claims.
 */
export function hasPermission(claim?: string): boolean {
  if (isSuperOrAdmin()) return true;
  if (!claim) return true;
  
  const perms = getUserPermissions();
  if (perms === 'all') return true;
  
  const list = perms.split(',').map(p => p.trim().toLowerCase());
  return list.includes(claim.trim().toLowerCase());
}

export interface ModulePermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

/**
 * Convenience helper to get full CRUD permissions for a module prefix.
 * e.g., getModulePermissions('flocks') -> { canView, canCreate, canEdit, canDelete }
 */
export function getModulePermissions(modulePrefix: string): ModulePermissions {
  if (isSuperOrAdmin()) {
    return {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
    };
  }

  const perms = getUserPermissions();
  const list = perms.split(',').map(p => p.trim().toLowerCase());
  const prefix = modulePrefix.toLowerCase();

  return {
    canView: list.includes(`${prefix}.view`),
    canCreate: list.includes(`${prefix}.create`),
    canEdit: list.includes(`${prefix}.edit`),
    canDelete: list.includes(`${prefix}.delete`),
  };
}

/**
 * Asserts a permission claim, throwing a standard Error if unauthorized.
 */
export function assertPermission(claim: string): void {
  if (!hasPermission(claim)) {
    throw new Error(`Permission Denied: Your account does not have "${claim}" access.`);
  }
}
