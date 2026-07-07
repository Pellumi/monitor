import { DomainTemplate } from './types';

export const domainTemplates: Record<string, DomainTemplate> = {
  ECOMMERCE: {
    id: 'ECOMMERCE',
    name: 'E-commerce Store',
    description: 'Shopping flow with authentication, browsing, cart, checkout, payment, and order tracking.',
    workflowType: 'ECOMMERCE',
    states: [
      { name: 'ANONYMOUS', category: 'NAVIGATION' },
      { name: 'REGISTER', category: 'BUSINESS' },
      { name: 'LOGIN', category: 'BUSINESS' },
      { name: 'PRODUCTS', category: 'BUSINESS' },
      { name: 'PRODUCT_DETAILS', category: 'BUSINESS' },
      { name: 'WISHLIST', category: 'UI' },
      { name: 'CART', category: 'BUSINESS' },
      { name: 'CHECKOUT', category: 'BUSINESS' },
      { name: 'CHECKOUT_SUCCESS', category: 'BUSINESS' },
      { name: 'ORDER_TRACKING', category: 'BUSINESS' },
    ],
    transitions: [
      { from: 'ANONYMOUS', to: 'REGISTER', action: 'SUBMIT_REGISTRATION' },
      { from: 'REGISTER', to: 'LOGIN', action: 'REGISTRATION_COMPLETE' },
      { from: 'LOGIN', to: 'PRODUCTS', action: 'LOGIN_SUCCESS' },
      { from: 'PRODUCTS', to: 'PRODUCT_DETAILS', action: 'VIEW_PRODUCT' },
      { from: 'PRODUCT_DETAILS', to: 'WISHLIST', action: 'SAVE_TO_WISHLIST' },
      { from: 'PRODUCT_DETAILS', to: 'CART', action: 'ADD_TO_CART' },
      { from: 'CART', to: 'CHECKOUT', action: 'START_CHECKOUT' },
      { from: 'CHECKOUT', to: 'CHECKOUT_SUCCESS', action: 'PAYMENT_APPROVED' },
      { from: 'CHECKOUT_SUCCESS', to: 'ORDER_TRACKING', action: 'VIEW_ORDER' },
    ],
    edgeCases: [
      {
        trigger: 'LOGIN',
        name: 'LOGIN_FAILURE',
        category: 'ERROR',
        criticality: 'HIGH',
        confidence: 0.95,
        reason: 'Authentication workflows should validate invalid credentials and rejected sign-in attempts.',
      },
      {
        trigger: 'PRODUCTS',
        name: 'NO_SEARCH_RESULTS',
        category: 'UI',
        criticality: 'MEDIUM',
        confidence: 0.86,
        reason: 'Product search and browsing should expose empty-result handling.',
      },
      {
        trigger: 'CART',
        name: 'EMPTY_CART',
        category: 'UI',
        criticality: 'HIGH',
        confidence: 0.88,
        reason: 'Cart flows should include a declared empty-cart state.',
      },
      {
        trigger: 'CART',
        name: 'OUT_OF_STOCK',
        category: 'ERROR',
        criticality: 'HIGH',
        confidence: 0.9,
        reason: 'Inventory can change after a user adds an item to cart.',
      },
      {
        trigger: 'CHECKOUT',
        name: 'PAYMENT_FAILURE',
        category: 'ERROR',
        criticality: 'CRITICAL',
        confidence: 0.97,
        reason: 'Checkout must handle failed payments before release.',
      },
      {
        trigger: 'CHECKOUT',
        name: 'PAYMENT_GATEWAY_TIMEOUT',
        category: 'SYSTEM',
        criticality: 'HIGH',
        confidence: 0.84,
        reason: 'Payment providers can timeout or fail independently of the storefront.',
      },
      {
        trigger: 'ORDER_TRACKING',
        name: 'ORDER_NOT_FOUND',
        category: 'ERROR',
        criticality: 'MEDIUM',
        confidence: 0.8,
        reason: 'Order lookup should declare the missing-order path.',
      },
    ],
  },
  LMS: {
    id: 'LMS',
    name: 'Education / LMS',
    description: 'Learning flow with discovery, enrollment, lesson progress, assessment, and completion.',
    workflowType: 'LMS',
    states: [
      { name: 'ANONYMOUS', category: 'NAVIGATION' },
      { name: 'VIEW_COURSES', category: 'BUSINESS' },
      { name: 'COURSE_DETAILS', category: 'BUSINESS' },
      { name: 'ENROLLMENT', category: 'BUSINESS' },
      { name: 'START_LESSON', category: 'BUSINESS' },
      { name: 'ASSESSMENT', category: 'BUSINESS' },
      { name: 'LESSON_COMPLETE', category: 'BUSINESS' },
    ],
    transitions: [
      { from: 'ANONYMOUS', to: 'VIEW_COURSES', action: 'OPEN_CATALOG' },
      { from: 'VIEW_COURSES', to: 'COURSE_DETAILS', action: 'SELECT_COURSE' },
      { from: 'COURSE_DETAILS', to: 'ENROLLMENT', action: 'ENROLL' },
      { from: 'ENROLLMENT', to: 'START_LESSON', action: 'ENROLLMENT_SUCCESS' },
      { from: 'START_LESSON', to: 'ASSESSMENT', action: 'START_ASSESSMENT' },
      { from: 'ASSESSMENT', to: 'LESSON_COMPLETE', action: 'PASS_ASSESSMENT' },
    ],
    edgeCases: [
      {
        trigger: 'ENROLLMENT',
        name: 'ENROLLMENT_FAILED',
        category: 'ERROR',
        criticality: 'HIGH',
        confidence: 0.88,
        reason: 'Enrollment should handle payment, permission, or capacity failures.',
      },
      {
        trigger: 'ASSESSMENT',
        name: 'ASSESSMENT_FAILED',
        category: 'BUSINESS',
        criticality: 'MEDIUM',
        confidence: 0.78,
        reason: 'Assessment flows should define unsuccessful completion or retry behavior.',
      },
    ],
  },
  AUTH: {
    id: 'AUTH',
    name: 'Authentication',
    description: 'Account access flow with register, login, reset, session expiry, and account-disabled states.',
    workflowType: 'AUTHENTICATION',
    states: [
      { name: 'REGISTER', category: 'BUSINESS' },
      { name: 'LOGIN', category: 'BUSINESS' },
      { name: 'AUTHENTICATED_HOME', category: 'NAVIGATION' },
      { name: 'LOGOUT', category: 'BUSINESS' },
    ],
    transitions: [
      { from: 'REGISTER', to: 'LOGIN', action: 'REGISTRATION_COMPLETE' },
      { from: 'LOGIN', to: 'AUTHENTICATED_HOME', action: 'LOGIN_SUCCESS' },
      { from: 'AUTHENTICATED_HOME', to: 'LOGOUT', action: 'LOG_OUT' },
    ],
    edgeCases: [
      {
        trigger: 'LOGIN',
        name: 'LOGIN_FAILURE',
        category: 'ERROR',
        criticality: 'HIGH',
        confidence: 0.95,
        reason: 'Invalid credentials are a required authentication path.',
      },
      {
        trigger: 'LOGIN',
        name: 'PASSWORD_RESET',
        category: 'SYSTEM',
        criticality: 'MEDIUM',
        confidence: 0.8,
        reason: 'Users need a recovery path when they cannot sign in.',
      },
      {
        trigger: 'AUTHENTICATED_HOME',
        name: 'SESSION_EXPIRED',
        category: 'SYSTEM',
        criticality: 'HIGH',
        confidence: 0.82,
        reason: 'Authenticated flows should declare session expiry behavior.',
      },
    ],
  },
  GENERIC_CRUD: {
    id: 'GENERIC_CRUD',
    name: 'Generic CRUD App',
    description: 'List, create, edit, delete, empty, loading, and validation paths for business records.',
    workflowType: 'GENERIC_CRUD',
    states: [
      { name: 'LIST_VIEW', category: 'NAVIGATION' },
      { name: 'DETAIL_VIEW', category: 'BUSINESS' },
      { name: 'CREATE_FORM', category: 'UI' },
      { name: 'CREATE_SUCCESS', category: 'BUSINESS' },
      { name: 'EDIT_FORM', category: 'UI' },
      { name: 'UPDATE_SUCCESS', category: 'BUSINESS' },
      { name: 'DELETE_CONFIRMATION', category: 'UI' },
    ],
    transitions: [
      { from: 'LIST_VIEW', to: 'DETAIL_VIEW', action: 'OPEN_RECORD' },
      { from: 'LIST_VIEW', to: 'CREATE_FORM', action: 'CREATE_RECORD' },
      { from: 'CREATE_FORM', to: 'CREATE_SUCCESS', action: 'SUBMIT_CREATE' },
      { from: 'DETAIL_VIEW', to: 'EDIT_FORM', action: 'EDIT_RECORD' },
      { from: 'EDIT_FORM', to: 'UPDATE_SUCCESS', action: 'SUBMIT_UPDATE' },
      { from: 'DETAIL_VIEW', to: 'DELETE_CONFIRMATION', action: 'DELETE_RECORD' },
    ],
    edgeCases: [
      {
        trigger: 'LIST_VIEW',
        name: 'EMPTY_LIST',
        category: 'UI',
        criticality: 'MEDIUM',
        confidence: 0.86,
        reason: 'List pages should declare the empty state.',
      },
      {
        trigger: 'CREATE_FORM',
        name: 'VALIDATION_ERROR',
        category: 'ERROR',
        criticality: 'HIGH',
        confidence: 0.9,
        reason: 'Create and edit forms should handle invalid input.',
      },
      {
        trigger: 'DETAIL_VIEW',
        name: 'RECORD_NOT_FOUND',
        category: 'ERROR',
        criticality: 'HIGH',
        confidence: 0.84,
        reason: 'Detail routes need an explicit not-found state.',
      },
    ],
  },
  CUSTOM: {
    id: 'CUSTOM',
    name: 'Custom Flow',
    description: 'Blank canvas for manually declaring the exact expected behavior graph.',
    workflowType: 'CUSTOM',
    states: [],
    transitions: [],
    edgeCases: [],
  },
};

export function getDomainTemplate(profileType: string): DomainTemplate {
  return domainTemplates[profileType.toUpperCase()] ?? domainTemplates.CUSTOM;
}

export function inferDomainTemplate(description: string): DomainTemplate {
  const normalized = description.toLowerCase();

  if (/\b(shop|store|cart|checkout|payment|order|product|wishlist|e-?commerce)\b/.test(normalized)) {
    return domainTemplates.ECOMMERCE;
  }

  if (/\b(course|lesson|student|teacher|enroll|quiz|assessment|learning|lms)\b/.test(normalized)) {
    return domainTemplates.LMS;
  }

  if (/\b(login|register|auth|password|session|account)\b/.test(normalized)) {
    return domainTemplates.AUTH;
  }

  if (/\b(create|edit|delete|record|list|dashboard|crud|admin)\b/.test(normalized)) {
    return domainTemplates.GENERIC_CRUD;
  }

  return domainTemplates.CUSTOM;
}
