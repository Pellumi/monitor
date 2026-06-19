import { ApplicationRuleSet } from './types';
import { authMissingStates } from './generic/auth';
import { crudMissingStates } from './generic/crud';
import { apiMissingStates } from './generic/api';
import { searchMissingStates } from './generic/search';
import { uploadMissingStates } from './generic/upload';
import { emptyStatesMissingStates } from './generic/empty-states';
import { permissionsMissingStates } from './generic/permissions';
import { recoveryMissingStates } from './generic/recovery';
import { loadingMissingStates } from './generic/loading';
import { errorsMissingStates } from './generic/errors';

export const lmsRules: ApplicationRuleSet = {
  stateExtractors: [
    { type: 'event', eventType: "QUIZ_SUBMITTED", state: "QUIZ_SUBMITTED" },
    { type: 'event', eventType: "COURSE_ENROLLED", state: "COURSE_ENROLLED" },
    { type: 'event', eventType: "COURSE_PUBLISHED", state: "COURSE_PUBLISHED" },
    { type: 'exactRoute', route: "/student/dashboard", state: "STUDENT_DASHBOARD" },
    { type: 'exactRoute', route: "/courses", state: "COURSE_CATALOG" },
    { type: 'exactRoute', route: "/course/enroll", state: "COURSE_ENROLLED" },
    { type: 'exactRoute', route: "/quiz/start", state: "QUIZ_STARTED" },
    { type: 'exactRoute', route: "/quiz/submit", state: "QUIZ_SUBMITTED" },
    { type: 'exactRoute', route: "/instructor/dashboard", state: "INSTRUCTOR_DASHBOARD" },
    { type: 'exactRoute', route: "/course/create", state: "COURSE_CREATED" },
    { type: 'exactRoute', route: "/course/publish", state: "COURSE_PUBLISHED" },
    { type: 'exactRoute', route: "/login", state: "LOGIN" },
    { type: 'exactRoute', route: "/register", state: "REGISTER" },
    { type: 'exactRoute', route: "/verify", state: "EMAIL_VERIFIED" },
    { type: 'exactRoute', route: "/", state: "ANONYMOUS_HOME" }
  ],
  missingStates: [
    ...authMissingStates,
    ...crudMissingStates,
    ...apiMissingStates,
    ...searchMissingStates,
    ...uploadMissingStates,
    ...emptyStatesMissingStates,
    ...permissionsMissingStates,
    ...recoveryMissingStates,
    ...loadingMissingStates,
    ...errorsMissingStates,
    {
      trigger: "QUIZ_SUBMITTED",
      candidate: "QUIZ_FAILED",
      confidence: 0.95,
      reason: "Observed quiz submission; expect a failure/retake state."
    },
    {
      trigger: "COURSE_ENROLLED",
      candidate: "ENROLLMENT_REJECTED",
      confidence: 0.8,
      reason: "Observed course enrollment; expect payment or capacity rejection path."
    },
    {
      trigger: "COURSE_PUBLISHED",
      candidate: "COURSE_ARCHIVED",
      confidence: 0.7,
      reason: "Published courses eventually need an archival or deletion path."
    }
  ],
  missingFlows: [
    {
      pattern: ["$prefix", "QUIZ_STARTED", "QUIZ_SUBMITTED"],
      transformation: {
        replace: {
          from: "QUIZ_SUBMITTED",
          to: "QUIZ_ABANDONED"
        }
      },
      confidence: 0.85,
      reason: "Students may start a quiz and abandon it before submission."
    },
    {
      pattern: ["$prefix", "COURSE_ENROLLED"],
      transformation: {
        replace: {
          from: "COURSE_ENROLLED",
          to: "ENROLLMENT_REJECTED"
        }
      },
      confidence: 0.9,
      reason: "Enrollment attempt may fail due to prerequisites or limits."
    }
  ]
};
