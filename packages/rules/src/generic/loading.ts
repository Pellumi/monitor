import { MissingStateRule } from '../types';

export const loadingMissingStates: MissingStateRule[] = [
  { trigger: "DATA_LOADED", candidate: "LOADING", category: "LOADING", confidence: 0.95, reason: "Loading indicators must be displayed and tested." },
  { trigger: "DATA_LOADED", candidate: "LOADING_FAILED", category: "ERROR", confidence: 0.9, reason: "Failures during initial data load must be handled." },
  { trigger: "DATA_LOADED", candidate: "LOADING_TIMEOUT", category: "LOADING", confidence: 0.8, reason: "Infinite loading spinners should be prevented with timeouts." }
];
