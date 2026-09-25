import { describe, expect, it } from 'vitest';
import { canonicalRoute, canonicalRouteFromPath } from './route';
import {
  ERROR_EVENT_TYPES,
  ERROR_EVENT_TYPE_SET,
  isErrorEventType,
  readErrorEventDetail,
} from './types';
import { EventTypeSchema } from './schema';

describe('error event taxonomy', () => {
  it('covers every error-shaped event the SDKs emit, not just ERROR_EVENT', () => {
    // The bug this replaces: a session full of UNHANDLED_EXCEPTIONs reported zero errors.
    expect(isErrorEventType('ERROR_EVENT')).toBe(true);
    expect(isErrorEventType('ERROR_OCCURRED')).toBe(true);
    expect(isErrorEventType('UNHANDLED_EXCEPTION')).toBe(true);
    expect(isErrorEventType('SERVER_ERROR')).toBe(true);
    expect(isErrorEventType('CLIENT_ERROR')).toBe(true);
  });

  it('treats a failed workflow as a flow outcome rather than a runtime error', () => {
    expect(isErrorEventType('WORKFLOW_FAILED')).toBe(false);
    expect(isErrorEventType('WORKFLOW_CANCELLED')).toBe(false);
  });

  it('ignores event types it has never heard of', () => {
    expect(isErrorEventType('PAGE_VIEW')).toBe(false);
    expect(isErrorEventType('')).toBe(false);
    expect(isErrorEventType('error_event')).toBe(false);
  });

  it('only names event types the schema actually accepts', () => {
    for (const eventType of ERROR_EVENT_TYPES) {
      expect(EventTypeSchema.safeParse(eventType).success).toBe(true);
    }
    expect(ERROR_EVENT_TYPE_SET.size).toBe(ERROR_EVENT_TYPES.length);
  });
});

describe('error event detail', () => {
  it('reads the message from wherever the producing SDK put it', () => {
    expect(readErrorEventDetail({ message: 'boom' }).message).toBe('boom');
    expect(readErrorEventDetail({ error: 'boom' }).message).toBe('boom');
    expect(readErrorEventDetail({ title: 'boom' }).message).toBe('boom');
    expect(readErrorEventDetail({ reason: 'boom' }).message).toBe('boom');
  });

  it('prefers message over the fallbacks when several are present', () => {
    expect(readErrorEventDetail({ message: 'first', error: 'second' }).message).toBe('first');
  });

  it('never returns a blank row for an error that carried no text', () => {
    expect(readErrorEventDetail({}).message).toBe('Unknown error');
    expect(readErrorEventDetail(null).message).toBe('Unknown error');
    expect(readErrorEventDetail(undefined).stack).toBeNull();
  });
});

describe('canonicalRoute', () => {
  it('reduces every framework template shape to the same route', () => {
    const expected = '/orders/{param}/items';
    expect(canonicalRoute('/orders/:id/items')).toBe(expected);
    expect(canonicalRoute('/orders/[id]/items')).toBe(expected);
    expect(canonicalRoute('/orders/{id}/items')).toBe(expected);
    expect(canonicalRoute('/orders/<int:pk>/items')).toBe(expected);
    expect(canonicalRoute('/orders/${id}/items')).toBe(expected);
    expect(canonicalRoute('/orders/[...id]/items')).toBe(expected);
  });

  it('normalises leading slash, trailing slash, query and hash', () => {
    expect(canonicalRoute('orders')).toBe('/orders');
    expect(canonicalRoute('/orders/')).toBe('/orders');
    expect(canonicalRoute('/orders///')).toBe('/orders');
    expect(canonicalRoute('/orders?page=2')).toBe('/orders');
    expect(canonicalRoute('/orders#top')).toBe('/orders');
    expect(canonicalRoute('/')).toBe('/');
    expect(canonicalRoute('')).toBe('/');
  });

  it('leaves a static route alone apart from casing', () => {
    expect(canonicalRoute('/Orders/Recent')).toBe('/orders/recent');
  });
});

describe('canonicalRouteFromPath', () => {
  it('collapses identifier-shaped segments a framework never marked dynamic', () => {
    // Without this, /orders/17 and /orders/18 are two endpoints in ClickHouse.
    expect(canonicalRouteFromPath('/orders/17/items')).toBe('/orders/{param}/items');
    expect(canonicalRouteFromPath('/users/507f1f77bcf86cd799439011')).toBe('/users/{param}');
    expect(canonicalRouteFromPath('/users/3f1a2b4c-5d6e-7f80-9a1b-2c3d4e5f6071')).toBe('/users/{param}');
  });

  it('does not mistake a word for an identifier', () => {
    expect(canonicalRouteFromPath('/orders/recent')).toBe('/orders/recent');
    expect(canonicalRouteFromPath('/v1/health')).toBe('/v1/health');
  });

  it('agrees with canonicalRoute on an already-templated route', () => {
    expect(canonicalRouteFromPath('/orders/:id')).toBe(canonicalRoute('/orders/:id'));
  });
});
