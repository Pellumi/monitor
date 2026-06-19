import { MissingStateRule } from '../types';

export const emptyStatesMissingStates: MissingStateRule[] = [
  { trigger: "COURSE_LIST", candidate: "NO_COURSES", confidence: 0.9, reason: "Users with no enrolled courses should see a tailored empty state." },
  { trigger: "ASSIGNMENTS", candidate: "NO_ASSIGNMENTS", confidence: 0.9, reason: "Users with no assignments should see a tailored empty state." },
  { trigger: "DASHBOARD", candidate: "EMPTY_DASHBOARD", confidence: 0.85, reason: "Brand new users should see an onboarding empty state dashboard." }
];
