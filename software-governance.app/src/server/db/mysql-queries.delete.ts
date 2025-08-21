/* ---------------------------------------------------------------------- */
/* Filepath: /src/server/db/mysql-queries.delete.ts */
/* ---------------------------------------------------------------------- */

import { keyRule, normalizeRowsWithKeys } from "@devcoons/row-normalizer";
import { exec, query } from "./mysql-client";
import { DbUserVisual, UserVisual } from "./mysql-types";
import { rules } from "./mysql-utils";

/* ---------------------------------------------------------------------- */

export async function deleteUser(userId: string): Promise<void> {
  await exec(
    `
    DELETE FROM users
    WHERE id = UNHEX(REPLACE(?, '-', ''))
    `,
    [userId]
  )
}

/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */