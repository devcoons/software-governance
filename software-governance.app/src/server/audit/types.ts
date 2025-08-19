
export type AuditType =
  | 'auth:login:success'
  | 'auth:login:fail'
  | 'auth:logout'
  | 'auth:totp:enabled'
  | 'auth:totp:verify:fail'
  | 'auth:session:rotate'
  | 'auth:session:revokeAll'
  | 'user:create'
  | 'user:delete'
  | 'user:role:change'
  | 'user:password:change'
  | 'user:password:reset'
  | 'software:create'
  | 'software:delete'
  | 'software:approve'
  | 'software:edit'
  | `custom.${string}`
