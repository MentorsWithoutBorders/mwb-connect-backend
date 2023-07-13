export interface Permissions {
  isMentor?: boolean;
  isOrgManager?: boolean;
  isCentreManager?: boolean;
  isAdmin?: boolean;
}

export default interface AdminPermission extends Permissions {
  id?: string;
  userId?: string;
}
