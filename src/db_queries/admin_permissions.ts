import pg from "pg";
import { Permissions } from "../models/admin_permissions.model";

export class AdminPermissions {
  async addPermission(
    userId: string,
    permissions: Permissions,
    client: pg.PoolClient
  ) {
    const insertPermissionQuery = `INSERT INTO admin_permissions (user_id, is_mentor, is_center_manager, is_org_manager, is_admin)
          VALUES ($1, $2, $3, $4, $5)`;
    await client.query(insertPermissionQuery, [
      userId,
      !!permissions.isMentor,
      !!permissions.isCenterManager,
      !!permissions.isOrgManager,
      !!permissions.isAdmin,
    ]);
  }
}
