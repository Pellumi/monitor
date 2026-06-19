import { EventType } from '@sots/shared';
import { SOTS } from './index';

interface AutoTrackConfig {
  autoTrackClicks?: boolean;
  autoTrackForms?: boolean;
  autoTrackRoutes?: boolean;
  errorTracking?: boolean;
}

// Utility to check if element or its parents should be ignored
function shouldIgnore(element: HTMLElement | null): boolean {
  let curr = element;
  while (curr) {
    if (curr.hasAttribute && curr.hasAttribute('data-sots-ignore')) {
      return true;
    }
    // Ignore password inputs completely
    if (curr.tagName === 'INPUT' && (curr as HTMLInputElement).type === 'password') {
      return true;
    }
    curr = curr.parentElement;
  }
  return false;
}

// CSS Selector generator
function getCssSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  let path: string[] = [];
  let curr: HTMLElement | null = el;
  while (curr && curr.nodeType === Node.ELEMENT_NODE) {
    let selector = curr.nodeName.toLowerCase();
    if (curr.className) {
      selector += `.${curr.className.trim().split(/\s+/).join('.')}`;
    }
    path.unshift(selector);
    curr = curr.parentElement;
  }
  return path.join(' > ');
}

// Utility to recursively sanitize sensitive keys in metadata
export function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sensitiveKeys = [
    'password',
    'credit_card',
    'cvv',
    'token',
    'secret',
    'private_key',
    'access_token',
    'authorization'
  ];

  const sanitize = (val: any): any => {
    if (val === null || val === undefined) return val;
    if (Array.isArray(val)) {
      return val.map(sanitize);
    }
    if (typeof val === 'object') {
      const result: Record<string, any> = {};
      for (const key of Object.keys(val)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = sanitize(val[key]);
        }
      }
      return result;
    }
    return val;
  };

  return sanitize(metadata);
}

export function setupAutoTrack(
  sdk: {
    trackEvent: (type: EventType, metadata?: Record<string, any>) => void;
  },
  config: AutoTrackConfig
): () => void {
  const cleanups: Array<() => void> = [];

  // 1. Clicks (Buttons & Links)
  if (config.autoTrackClicks !== false) {
    const clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Find closest button or link
      const interactiveEl = target.closest('a, button, [role="button"]') as HTMLElement | null;
      if (!interactiveEl || shouldIgnore(interactiveEl)) return;

      const isLink = interactiveEl.tagName === 'A';
      const eventType = isLink ? 'LINK_CLICK' : 'BUTTON_CLICK';
      
      const text = interactiveEl.innerText?.trim().slice(0, 100) || '';
      const elementId = interactiveEl.id || '';
      const selector = getCssSelector(interactiveEl);

      const metadata: Record<string, any> = {
        elementId,
        text,
        selector,
      };

      if (isLink) {
        metadata.href = interactiveEl.getAttribute('href') || '';
      }

      sdk.trackEvent(eventType, metadata);
    };

    document.addEventListener('click', clickHandler, true);
    cleanups.push(() => document.removeEventListener('click', clickHandler, true));
  }

  // 2. Form Submissions
  if (config.autoTrackForms !== false) {
    const submitHandler = (e: Event) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || shouldIgnore(form)) return;

      const formId = form.id || '';
      const formAction = form.getAttribute('action') || '';
      
      // Capture only names of fields, never values
      const fields: string[] = [];
      const elements = form.elements;
      for (let i = 0; i < elements.length; i++) {
        const item = elements[i] as HTMLInputElement;
        if (item.name) {
          fields.push(item.name);
        } else if (item.id) {
          fields.push(item.id);
        }
      }

      sdk.trackEvent('FORM_SUBMITTED', {
        formId,
        formAction,
        fields,
      });
    };

    document.addEventListener('submit', submitHandler, true);
    cleanups.push(() => document.removeEventListener('submit', submitHandler, true));
  }

  // 3. SPA Route Changes
  if (config.autoTrackRoutes !== false) {
    let lastUrl = window.location.href;

    const handleRouteChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl === lastUrl) return;

      const from = lastUrl;
      const to = currentUrl;
      lastUrl = currentUrl;

      sdk.trackEvent('ROUTE_CHANGE', { from, to });

      // Emit settled PAGE_VIEW
      setTimeout(() => {
        sdk.trackEvent('PAGE_VIEW', {
          url: window.location.href,
          title: document.title,
          referrer: document.referrer,
        });
      }, 50);
    };

    // Patch history pushState and replaceState
    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;

    history.pushState = function (...args) {
      origPushState.apply(this, args);
      handleRouteChange();
    };

    history.replaceState = function (...args) {
      origReplaceState.apply(this, args);
      handleRouteChange();
    };

    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);

    cleanups.push(() => {
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    });
  }

  // 4. Unhandled Errors and Promise Rejections
  if (config.errorTracking !== false) {
    const errorHandler = (e: ErrorEvent) => {
      // Ignore errors that don't look like actual exceptions or are cross-origin script issues
      const message = e.message || 'Unknown window error';
      const stack = e.error instanceof Error ? e.error.stack : null;
      const name = e.error instanceof Error ? e.error.name : 'Error';

      sdk.trackEvent('UNHANDLED_EXCEPTION', {
        message,
        stack,
        name,
      });
    };

    const rejectionHandler = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : null;
      const name = reason instanceof Error ? reason.name : 'UnhandledRejection';

      sdk.trackEvent('UNHANDLED_EXCEPTION', {
        message,
        stack,
        name,
      });
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    cleanups.push(() => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    });
  }

  return () => {
    cleanups.forEach(cleanup => cleanup());
  };
}
