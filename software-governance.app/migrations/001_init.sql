-- schema_mariadb_binary16.sql
-- Core auth schema for MariaDB (works in phpMyAdmin).
-- UUIDs stored as BINARY(16). App must convert UUID <-> 16-byte buffers.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================
-- USERS
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id                        BINARY(16)   NOT NULL PRIMARY KEY,                -- UUID in 16 bytes
  email                     VARCHAR(255) NOT NULL,                            -- human-facing email
  username                  VARCHAR(255) NOT NULL,                            -- alternate login handle
  password                  VARCHAR(255) NOT NULL,                            -- argon2id hash
  is_active                 TINYINT(1)   NOT NULL DEFAULT 1,                  -- soft disable
  roles                     LONGTEXT NULL CHECK (JSON_VALID(roles)),          -- JSON array of strings
  permissions               LONGTEXT NULL CHECK (JSON_VALID(permissions)),    -- JSON array of strings
  totp_enabled              TINYINT(1)   NOT NULL DEFAULT 0,
  force_password_change     TINYINT(1)   NOT NULL DEFAULT 0,
  temp_password_issued_at   DATETIME     NULL,
  temp_password_used_at     DATETIME     NULL,
  last_login_at             DATETIME     NULL,
  created_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username),
  INDEX idx_users_created (created_at),
  INDEX idx_users_active (is_active)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci;


-- =========================================================
-- USER_PROFILE
-- =========================================================
CREATE TABLE IF NOT EXISTS user_profile (
  user_id     BINARY(16)   NOT NULL PRIMARY KEY,             -- FK to users.id
  first_name  VARCHAR(100) NULL,                        
  last_name   VARCHAR(100) NULL,
  phone_number VARCHAR(100) NULL,
  timezone     VARCHAR(100) NULL,
  CONSTRAINT fk_profile_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
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
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS notifications (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recipient_id   BINARY(16)   NOT NULL,                       -- who receives it
  sender_id      BINARY(16)   NULL,                           -- who sent it (optional; NULL for system)
  type           VARCHAR(64)  NOT NULL,                       -- e.g., TEMP_PASSWORD_REQUEST
  payload        LONGTEXT NULL CHECK (JSON_VALID(payload)),   -- optional JSON details
  state          VARCHAR(32)  NOT NULL DEFAULT 'new',         -- new | seen | done
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at   DATETIME     NULL,

  INDEX idx_notifications_recipient_created (recipient_id, created_at),
  INDEX idx_notifications_recipient_state   (recipient_id, state, created_at),
  INDEX idx_notifications_sender_created    (sender_id, created_at),

  CONSTRAINT fk_notifications_recipient
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_sender
    FOREIGN KEY (sender_id)    REFERENCES users(id) ON DELETE SET NULL
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


