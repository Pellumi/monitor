import { PrismaClient } from '@sots/db';

const prisma = new PrismaClient();

const normalizationEntries = [
  // Registration synonyms → USER_REGISTRATION
  { rawName: 'REGISTER',        canonical: 'USER_REGISTRATION', libraryVersion: '1.0.0' },
  { rawName: 'SIGN_UP',         canonical: 'USER_REGISTRATION', libraryVersion: '1.0.0' },
  { rawName: 'CREATE_ACCOUNT',  canonical: 'USER_REGISTRATION', libraryVersion: '1.0.0' },
  { rawName: 'JOIN',            canonical: 'USER_REGISTRATION', libraryVersion: '1.0.0' },
  { rawName: 'JOIN_PLATFORM',   canonical: 'USER_REGISTRATION', libraryVersion: '1.0.0' },
  // Authentication synonyms → USER_AUTHENTICATION
  { rawName: 'LOGIN',           canonical: 'USER_AUTHENTICATION', libraryVersion: '1.0.0' },
  { rawName: 'SIGN_IN',         canonical: 'USER_AUTHENTICATION', libraryVersion: '1.0.0' },
  { rawName: 'AUTHENTICATE',    canonical: 'USER_AUTHENTICATION', libraryVersion: '1.0.0' },
  // Checkout synonyms → ORDER_CHECKOUT
  { rawName: 'CHECKOUT',        canonical: 'ORDER_CHECKOUT', libraryVersion: '1.0.0' },
  { rawName: 'PLACE_ORDER',     canonical: 'ORDER_CHECKOUT', libraryVersion: '1.0.0' },
  // LMS: Assessment submission
  { rawName: 'QUIZ_SUBMITTED',  canonical: 'ASSESSMENT_SUBMISSION', libraryVersion: '1.0.0' },
  { rawName: 'EXAM_SUBMITTED',  canonical: 'ASSESSMENT_SUBMISSION', libraryVersion: '1.0.0' },
  { rawName: 'SUBMIT_QUIZ',     canonical: 'ASSESSMENT_SUBMISSION', libraryVersion: '1.0.0' },
  // LMS: Course enrollment
  { rawName: 'COURSE_ENROLLED', canonical: 'CONTENT_ENROLLMENT', libraryVersion: '1.0.0' },
  { rawName: 'ENROLL',          canonical: 'CONTENT_ENROLLMENT', libraryVersion: '1.0.0' },
];

const patternEntries = [
  // USER_REGISTRATION patterns
  { patternId: 'pat_reg_001', triggerCanonicals: 'USER_REGISTRATION', triggerCategory: 'BUSINESS',
    suggestedStateName: 'REGISTRATION_FAILED', category: 'ERROR',
    confidence: 0.97, rationale: 'Every registration flow requires a failure state.', libraryVersion: '1.0.0' },
  { patternId: 'pat_reg_002', triggerCanonicals: 'USER_REGISTRATION', triggerCategory: 'BUSINESS',
    suggestedStateName: 'DUPLICATE_EMAIL_ERROR', category: 'ERROR',
    confidence: 0.82, rationale: 'Duplicate account detection is a standard registration edge case.', libraryVersion: '1.0.0' },
  { patternId: 'pat_reg_003', triggerCanonicals: 'USER_REGISTRATION', triggerCategory: 'BUSINESS',
    suggestedStateName: 'EMAIL_VERIFICATION_REQUIRED', category: 'BUSINESS',
    confidence: 0.78, rationale: 'Most platforms require email verification post-registration.', libraryVersion: '1.0.0' },

  // USER_AUTHENTICATION patterns
  { patternId: 'pat_auth_001', triggerCanonicals: 'USER_AUTHENTICATION', triggerCategory: 'BUSINESS',
    suggestedStateName: 'LOGIN_FAILURE', category: 'ERROR',
    confidence: 0.99, rationale: 'Login must always have a corresponding failure state.', libraryVersion: '1.0.0' },
  { patternId: 'pat_auth_002', triggerCanonicals: 'USER_AUTHENTICATION', triggerCategory: 'BUSINESS',
    suggestedStateName: 'PASSWORD_RESET_REQUESTED', category: 'BUSINESS',
    confidence: 0.90, rationale: 'Forgot password is almost universally paired with login.', libraryVersion: '1.0.0' },
  { patternId: 'pat_auth_003', triggerCanonicals: 'USER_AUTHENTICATION', triggerCategory: 'BUSINESS',
    suggestedStateName: 'ACCOUNT_LOCKED', category: 'ERROR',
    confidence: 0.76, rationale: 'Brute-force protection creates an account-locked state.', libraryVersion: '1.0.0' },
  { patternId: 'pat_auth_004', triggerCanonicals: 'USER_AUTHENTICATION', triggerCategory: 'BUSINESS',
    suggestedStateName: 'SESSION_TIMEOUT', category: 'SYSTEM',
    confidence: 0.71, rationale: 'Sessions expire; timeout state must be handled.', libraryVersion: '1.0.0' },

  // ORDER_CHECKOUT patterns
  { patternId: 'pat_chk_001', triggerCanonicals: 'ORDER_CHECKOUT', triggerCategory: 'BUSINESS',
    suggestedStateName: 'PAYMENT_FAILED', category: 'ERROR',
    confidence: 0.99, rationale: 'Payment failure is a mandatory checkout path.', libraryVersion: '1.0.0' },
  { patternId: 'pat_chk_002', triggerCanonicals: 'ORDER_CHECKOUT', triggerCategory: 'BUSINESS',
    suggestedStateName: 'EMPTY_CART', category: 'UI',
    confidence: 0.91, rationale: 'Checkout from an empty cart must be handled.', libraryVersion: '1.0.0' },
  { patternId: 'pat_chk_003', triggerCanonicals: 'ORDER_CHECKOUT', triggerCategory: 'BUSINESS',
    suggestedStateName: 'OUT_OF_STOCK', category: 'BUSINESS',
    confidence: 0.74, rationale: 'Inventory depletion during checkout is a known edge case.', libraryVersion: '1.0.0' },
  { patternId: 'pat_chk_004', triggerCanonicals: 'ORDER_CHECKOUT', triggerCategory: 'BUSINESS',
    suggestedStateName: 'PROMO_CODE_INVALID', category: 'ERROR',
    confidence: 0.63, rationale: 'Promotion validation failures are common checkout states.', libraryVersion: '1.0.0' },

  // ASSESSMENT_SUBMISSION patterns (LMS)
  { patternId: 'pat_lms_001', triggerCanonicals: 'ASSESSMENT_SUBMISSION', triggerCategory: 'BUSINESS',
    suggestedStateName: 'SUBMISSION_FAILED', category: 'ERROR',
    confidence: 0.96, rationale: 'Network/server errors during submission must be handled.', libraryVersion: '1.0.0' },
  { patternId: 'pat_lms_002', triggerCanonicals: 'ASSESSMENT_SUBMISSION', triggerCategory: 'BUSINESS',
    suggestedStateName: 'QUIZ_RESULTS_PENDING', category: 'BUSINESS',
    confidence: 0.85, rationale: 'Async grading creates a pending results state.', libraryVersion: '1.0.0' },
  { patternId: 'pat_lms_003', triggerCanonicals: 'ASSESSMENT_SUBMISSION', triggerCategory: 'BUSINESS',
    suggestedStateName: 'LATE_SUBMISSION_BLOCKED', category: 'BUSINESS',
    confidence: 0.80, rationale: 'LMS platforms typically block submissions after the deadline.', libraryVersion: '1.0.0' },

  // CONTENT_ENROLLMENT patterns (LMS)
  { patternId: 'pat_lms_004', triggerCanonicals: 'CONTENT_ENROLLMENT', triggerCategory: 'BUSINESS',
    suggestedStateName: 'ENROLLMENT_FAILED', category: 'ERROR',
    confidence: 0.88, rationale: 'Enrollment failures (capacity, permissions) must be handled.', libraryVersion: '1.0.0' },
  { patternId: 'pat_lms_005', triggerCanonicals: 'CONTENT_ENROLLMENT', triggerCategory: 'BUSINESS',
    suggestedStateName: 'COURSE_FULL', category: 'BUSINESS',
    confidence: 0.65, rationale: 'Course capacity limits are common in LMS platforms.', libraryVersion: '1.0.0' },
];

export async function seedFDRS() {
  console.log('Seeding Intent Normalization entries...');
  for (const entry of normalizationEntries) {
    const existing = await prisma.intentNormalizationEntry.findFirst({
      where: {
        scope: 'GLOBAL',
        rawName: entry.rawName,
        applicationId: null,
        organizationId: null,
      },
    });

    if (existing) {
      await prisma.intentNormalizationEntry.update({
        where: { id: existing.id },
        data: {
          canonical: entry.canonical,
          libraryVersion: entry.libraryVersion,
        },
      });
    } else {
      await prisma.intentNormalizationEntry.create({
        data: {
          scope: 'GLOBAL',
          rawName: entry.rawName,
          canonical: entry.canonical,
          libraryVersion: entry.libraryVersion,
        },
      });
    }
  }

  console.log('Seeding Pattern Library entries...');
  for (const pattern of patternEntries) {
    await prisma.patternLibraryEntry.upsert({
      where: { patternId: pattern.patternId },
      update: {
        triggerCanonicals: pattern.triggerCanonicals,
        triggerCategory: pattern.triggerCategory,
        suggestedStateName: pattern.suggestedStateName,
        category: pattern.category,
        confidence: pattern.confidence,
        rationale: pattern.rationale,
        libraryVersion: pattern.libraryVersion,
        active: true,
      },
      create: {
        patternId: pattern.patternId,
        triggerCanonicals: pattern.triggerCanonicals,
        triggerCategory: pattern.triggerCategory,
        suggestedStateName: pattern.suggestedStateName,
        category: pattern.category,
        confidence: pattern.confidence,
        rationale: pattern.rationale,
        libraryVersion: pattern.libraryVersion,
        active: true,
      },
    });
  }

  console.log(`FDRS Seeding complete: ${normalizationEntries.length} normalizations, ${patternEntries.length} patterns.`);
}

async function main() {
  try {
    await seedFDRS();
  } catch (err) {
    console.error('Error seeding FDRS:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Only run automatically if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  main();
}
