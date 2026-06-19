import { MissingStateRule } from '../types';

export const crudMissingStates: MissingStateRule[] = [
  { trigger: "CREATE_SUCCESS", candidate: "CREATE_FAILURE", confidence: 0.9, reason: "Creation forms should handle validation and server errors." },
  { trigger: "UPDATE_SUCCESS", candidate: "UPDATE_FAILURE", confidence: 0.9, reason: "Update forms should handle validation and concurrency errors." },
  { trigger: "DELETE_SUCCESS", candidate: "DELETE_FAILURE", confidence: 0.9, reason: "Deletions may fail due to foreign key constraints or permissions." }
];
