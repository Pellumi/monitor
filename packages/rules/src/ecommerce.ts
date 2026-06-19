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

export const ecommerceRules: ApplicationRuleSet = {
  stateExtractors: [
    { type: 'exactRoute', route: "/checkout/success", state: "CHECKOUT_SUCCESS" },
    { type: 'exactRoute', route: "/checkout", state: "CHECKOUT" },
    { type: 'exactRoute', route: "/cart", state: "CART" },
    { type: 'exactRoute', route: "/products", state: "PRODUCTS" },
    { type: 'exactRoute', route: "/login", state: "LOGIN" },
    { type: 'exactRoute', route: "/register", state: "REGISTER" },
    { type: 'exactRoute', route: "/", state: "HOME" }
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
      trigger: "CHECKOUT_SUCCESS",
      candidate: "PAYMENT_FAILURE",
      confidence: 0.95,
      reason: "Observed successful checkout; expect a complementary failure path."
    },
    {
      trigger: "CART",
      candidate: "EMPTY_CART",
      confidence: 0.85,
      reason: "Cart is accessed, user should be able to empty it."
    }
  ],
  missingFlows: [
    {
      pattern: ["$prefix", "CART", "CHECKOUT"],
      transformation: {
        replace: {
          from: "CHECKOUT",
          to: "EMPTY_CART"
        }
      },
      confidence: 0.9,
      reason: "Shopping flow should account for cart abandonment."
    }
  ]
};
