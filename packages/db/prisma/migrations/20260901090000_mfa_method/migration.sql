-- Records which second factor a user has active.
-- TOTP is an authenticator app; EMAIL_OTP sends a code to the registered address.
CREATE TYPE "MfaMethod" AS ENUM ('NONE', 'TOTP', 'EMAIL_OTP');

ALTER TABLE "User" ADD COLUMN "mfaMethod" "MfaMethod" NOT NULL DEFAULT 'NONE';

-- Anyone who already completed TOTP enrolment keeps it as their active method.
UPDATE "User" SET "mfaMethod" = 'TOTP' WHERE "totpEnabled" = true;
