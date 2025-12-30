export type AuditChange = {
  from: unknown;
  to: unknown;
};

export type AuditLogEntry = {
  id: string;
  at: string;
  actor: string;
  entity: "task" | "project";
  entityId: string;
  projectId: string | null;
  action:
    | "create"
    | "update"
    | "delete"
    | "move"
    | "member_add"
    | "status_add"
    | "status_remove";
  changes: Record<string, AuditChange>;
};
