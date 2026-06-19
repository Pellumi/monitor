import { MissingStateRule } from '../types';

export const permissionsMissingStates: MissingStateRule[] = [
  { trigger: "AUTHENTICATED", candidate: "ACCESS_DENIED", confidence: 0.95, reason: "Authenticated users attempting to access restricted resources should be denied." },
  { trigger: "COURSE_VIEWED", candidate: "UNAUTHORIZED_ACCESS", confidence: 0.9, reason: "Users should not be able to view courses they are not enrolled in." },
  { trigger: "ADMIN_PAGE", candidate: "INSUFFICIENT_PERMISSIONS", confidence: 0.95, reason: "Non-admins attempting to view admin pages must be blocked." }
];
