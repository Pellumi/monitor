-- Refresh-token rotation grace window.
--
-- Rotation used to revoke the presented token the instant a new one was issued,
-- so any request that raced the rotation (a second tab, an in-flight retry, a
-- reload landing mid-rotation) presented a token that no longer existed and was
-- logged out. These columns let a rotation keep its predecessor addressable for
-- a few seconds: within the window the caller is handed a fresh pair, and after
-- it the same presentation is unambiguous token reuse.
ALTER TABLE "UserSession" ADD COLUMN IF NOT EXISTS "previousRefreshTokenHash" TEXT;
ALTER TABLE "UserSession" ADD COLUMN IF NOT EXISTS "rotatedAt" TIMESTAMP(3);

ALTER TABLE "DeviceSession" ADD COLUMN IF NOT EXISTS "previousRefreshTokenHash" TEXT;
ALTER TABLE "DeviceSession" ADD COLUMN IF NOT EXISTS "rotatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "UserSession_previousRefreshTokenHash_key"
  ON "UserSession"("previousRefreshTokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceSession_previousRefreshTokenHash_key"
  ON "DeviceSession"("previousRefreshTokenHash");
