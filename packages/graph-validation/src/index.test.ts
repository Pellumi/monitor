import { validateGeneratedGraph } from './index';

const valid = validateGeneratedGraph({
  workflows: [{
    key: 'checkout',
    name: 'Checkout',
    states: [
      { name: 'Cart' },
      { name: 'Checkout Success' },
    ],
    transitions: [
      { from: 'Cart', to: 'Checkout Success', action: 'Pay' },
    ],
  }],
});

if (!valid.valid) {
  throw new Error(`Expected valid graph: ${JSON.stringify(valid.errors)}`);
}

const invalid = validateGeneratedGraph({
  workflows: [{
    key: 'bad',
    name: 'Bad',
    states: [{ name: 'A' }],
    transitions: [{ from: 'A', to: 'Missing' }],
  }],
});

if (invalid.valid || invalid.errors[0]?.code !== 'TRANSITION_REFERENCES_MISSING_STATE') {
  throw new Error('Expected missing-state transition validation failure');
}
