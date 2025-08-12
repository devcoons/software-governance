-- schema_mariadb_binary16.sql
-- Core auth schema for MariaDB (works in phpMyAdmin).
-- UUIDs stored as BINARY(16). App must convert UUID <-> 16-byte buffers.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================
-- USERS
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id                     BINARY(16)   NOT NULL PRIMARY KEY,  -- UUID in 16 bytes
  email                  VARCHAR(255) NOT NULL,               -- human-facing email
  password               VARCHAR(255) NOT NULL,               -- argon2id hash
  roles                  LONGTEXT NULL CHECK (JSON_VALID(roles)),
  permissions            LONGTEXT NULL CHECK (JSON_VALID(permissions)),
  totp_enabled           TINYINT(1)   NOT NULL DEFAULT 0,
  force_password_change  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  INDEX idx_users_created (created_at)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci;

-- =========================================================
-- USER_TOTP
-- =========================================================
CREATE TABLE IF NOT EXISTS user_totp (
  user_id     BINARY(16)   NOT NULL PRIMARY KEY,             -- FK to users.id
  secret_b32  VARCHAR(100) NOT NULL,                          -- Base32 TOTP secret (consider encrypt-at-rest later)
  enrolled_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_totp_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci;

-- =========================================================
-- AUDIT LOG
-- =========================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id  BINARY(16) NULL,                                   -- nullable; e.g., failed login with unknown email
  type     VARCHAR(64) NOT NULL,                              -- e.g., login_success, login_fail, password_change
  meta     LONGTEXT NULL CHECK (JSON_VALID(meta)),            -- arbitrary JSON details
  at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_at (at),
  INDEX idx_audit_user_at (user_id, at),
  CONSTRAINT fk_audit_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================
-- NOTES
-- ============================
-- 1) Only these three tables are required for the planned system:
--    - users: credentials, flags, RBAC fields
--    - user_totp: TOTP secret per user
--    - audit_log: security/audit trail
--    Sessions, refresh tokens, and rate limits live in Redis.
--
-- 2) Application must handle UUID <-> BINARY(16):
--    - On INSERT/SELECT, convert between string UUID and 16-byte Buffer/Uint8Array.
--    - (If you ever switch to MySQL 8+, UUID_TO_BIN/BIN_TO_UUID exist, but in MariaDB
--      you should do conversion in the app layer for portability.)
--
-- 3) JSON columns in MariaDB are LONGTEXT with JSON_VALID() checks.
--    On older MariaDB, CHECK is parsed but not enforced; it's fine to keep it.
