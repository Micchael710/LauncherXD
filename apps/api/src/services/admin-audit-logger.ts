import { AdminIdentity } from "../auth/admin-auth-provider";

export class AdminAuditLogger {
  static logAction(identity: AdminIdentity, resource: string, resourceId: string, action: string, result: string, details?: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      admin_subject: identity.subject,
      resource,
      resource_id: resourceId,
      action,
      result,
      ...details
    };

    console.log(`[AdminAudit] ${JSON.stringify(logEntry)}`);
  }
}
