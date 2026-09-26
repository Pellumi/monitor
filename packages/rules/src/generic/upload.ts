import { MissingStateRule } from '../types';

export const uploadMissingStates: MissingStateRule[] = [
  { trigger: "UPLOAD_SUCCESS", candidate: "UPLOAD_FAILURE", category: "ERROR", confidence: 0.9, reason: "Uploads can fail due to network drops." },
  { trigger: "UPLOAD_SUCCESS", candidate: "FILE_TOO_LARGE", category: "ERROR", confidence: 0.95, reason: "File size limits should be explicitly tested." },
  { trigger: "UPLOAD_SUCCESS", candidate: "UNSUPPORTED_FORMAT", category: "ERROR", confidence: 0.95, reason: "MIME type validation should be tested." }
];
