/**
 * Better Auth database migration script.
 * Creates required tables if they don't exist.
 * Run once before starting the server.
 */
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
CREATE TABLE IF NOT EXISTS "user" (
  "id"            TEXT        NOT NULL PRIMARY KEY,
  "name"          TEXT        NOT NULL,
  "email"         TEXT        NOT NULL UNIQUE,
  "emailVerified" BOOLEAN     NOT NULL DEFAULT false,
  "image"         TEXT,
  "createdAt"     TIMESTAMP   NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id"         TEXT        NOT NULL PRIMARY KEY,
  "expiresAt"  TIMESTAMP   NOT NULL,
  "token"      TEXT        NOT NULL UNIQUE,
  "createdAt"  TIMESTAMP   NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMP   NOT NULL DEFAULT NOW(),
  "ipAddress"  TEXT,
  "userAgent"  TEXT,
  "userId"     TEXT        NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id"                    TEXT        NOT NULL PRIMARY KEY,
  "accountId"             TEXT        NOT NULL,
  "providerId"            TEXT        NOT NULL,
  "userId"                TEXT        NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken"           TEXT,
  "refreshToken"          TEXT,
  "idToken"               TEXT,
  "accessTokenExpiresAt"  TIMESTAMP,
  "refreshTokenExpiresAt" TIMESTAMP,
  "scope"                 TEXT,
  "password"              TEXT,
  "createdAt"             TIMESTAMP   NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id"         TEXT        NOT NULL PRIMARY KEY,
  "identifier" TEXT        NOT NULL,
  "value"      TEXT        NOT NULL,
  "expiresAt"  TIMESTAMP   NOT NULL,
  "createdAt"  TIMESTAMP,
  "updatedAt"  TIMESTAMP
);
`;

try {
  await pool.query(sql);
  console.log('Better Auth migrations completed successfully.');
} catch (err) {
  console.error('Better Auth migration failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
