import { MissingStateRule } from '../types';

export const authMissingStates: MissingStateRule[] = [
  { trigger: "LOGIN_SUCCESS", candidate: "LOGIN_FAILURE", confidence: 0.95, reason: "Authentication should have a tested failure path." },
  { trigger: "LOGIN_SUCCESS", candidate: "SESSION_EXPIRED", confidence: 0.8, reason: "Sessions should expire and correctly redirect users." },
  { trigger: "REGISTER_SUCCESS", candidate: "REGISTRATION_FAILURE", confidence: 0.95, reason: "Registration failures (validation, duplicates) must be tested." },
  { trigger: "EMAIL_VERIFIED", candidate: "EMAIL_VERIFICATION_FAILED", confidence: 0.9, reason: "Invalid or expired verification tokens should be handled." }
];
