import { MissingStateRule } from '../types';

export const recoveryMissingStates: MissingStateRule[] = [
  { trigger: "LOGIN_FAILURE", candidate: "PASSWORD_RESET", confidence: 0.95, reason: "Users who fail to login should be offered a password reset." },
  { trigger: "PAYMENT_FAILURE", candidate: "RETRY_PAYMENT", confidence: 0.9, reason: "Failed payments should offer a retry mechanism." },
  { trigger: "QUIZ_FAILED", candidate: "QUIZ_RETAKE", confidence: 0.85, reason: "Failed quizzes may offer retakes depending on policy." }
];
