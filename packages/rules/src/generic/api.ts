import { MissingStateRule } from '../types';

export const apiMissingStates: MissingStateRule[] = [
  { trigger: "API_SUCCESS", candidate: "API_TIMEOUT", confidence: 0.85, reason: "API calls should handle slow networks gracefully." },
  { trigger: "API_SUCCESS", candidate: "API_ERROR", confidence: 0.9, reason: "Generic API error handling should be tested." },
  { trigger: "API_SUCCESS", candidate: "UNAUTHORIZED", confidence: 0.85, reason: "APIs should handle token expiration and unauthorized requests." }
];
