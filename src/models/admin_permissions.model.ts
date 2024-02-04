export interface Permissions {
  isMentor?: boolean;
  isOrgManager?: boolean;
  isCenterManager?: boolean;
  isAdmin?: boolean;
}

export default interface AdminPermission extends Permissions {
  id?: string;
  userId?: string;
}
