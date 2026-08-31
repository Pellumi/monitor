-- A second-factor code must not be interchangeable with a first-factor login
-- code, so MFA gets its own purpose rather than reusing LOGIN.
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'MFA';
