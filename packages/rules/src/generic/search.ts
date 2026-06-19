import { MissingStateRule } from '../types';

export const searchMissingStates: MissingStateRule[] = [
  { trigger: "SEARCH_RESULTS", candidate: "NO_RESULTS", confidence: 0.95, reason: "Search functionality must handle empty result sets gracefully." },
  { trigger: "SEARCH_RESULTS", candidate: "SEARCH_ERROR", confidence: 0.8, reason: "Search operations should handle backend failures." }
];
