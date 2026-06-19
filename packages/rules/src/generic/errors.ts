import { MissingStateRule } from '../types';

export const errorsMissingStates: MissingStateRule[] = [
  { trigger: "API_SUCCESS", candidate: "API_ERROR", confidence: 0.95, reason: "General API error boundaries must be tested." },
  { trigger: "API_SUCCESS", candidate: "RATE_LIMITED", confidence: 0.85, reason: "429 Rate Limit responses should be gracefully handled." },
  { trigger: "API_SUCCESS", candidate: "SERVICE_UNAVAILABLE", confidence: 0.9, reason: "503 Service Unavailable responses should be tested." },
  { trigger: "API_SUCCESS", candidate: "NETWORK_FAILURE", confidence: 0.95, reason: "Offline or disconnected network states must be handled." }
];
