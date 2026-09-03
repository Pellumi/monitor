-- Custom profile picture support.
--
-- `avatarKey` stores the object-storage key of an uploaded avatar image. When
-- present it takes precedence over `avatarUrl` (an external DiceBear URL the
-- user picked). Both NULL means the account renders a DiceBear avatar seeded
-- from the user's email.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarKey" TEXT;
