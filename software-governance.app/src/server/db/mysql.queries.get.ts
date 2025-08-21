/* ---------------------------------------------------------------------- */
/* Filepath: /src/server/db/mysql.queries.ts */
/* ---------------------------------------------------------------------- */

import { keyRule, normalizeRowsWithKeys } from "@devcoons/row-normalizer";
import { query } from "./mysql-client";
import { DbUserVisual, UserVisual } from "./mysql.types";
import { rules } from "./mysql.utils";

/* ---------------------------------------------------------------------- */

export async function listAllUsersVisual(): Promise<UserVisual[]> {
  const rows = await query<DbUserVisual[]>(
    `   SELECT u.id, u.email, u.is_active, u.roles, u.last_login_at, p.first_name, p.last_name
        FROM users AS u LEFT JOIN user_profile AS p ON p.user_id = u.id; `
  )
  return rows ? normalizeRowsWithKeys(rows as unknown as DbUserVisual[], rules) : []
}

/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */