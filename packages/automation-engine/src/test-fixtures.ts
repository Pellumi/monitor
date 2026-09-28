import { AutomationLimitsSchema } from '@tellann/desktop-contracts';
import type { AutomationLimits } from '@tellann/desktop-contracts';
import type { ActionOutcome, AutomationEvent, AutomationPorts, StepHandOver } from './executor';
import type {
  AutomationAction,
  ControlDescriptor,
  ExecutableContract,
  ExecutableState,
  ExecutableTransition,
  ObservedRequest,
  SemanticElement,
  SemanticSnapshot,
} from './types';

export const ORIGIN = 'http://localhost:3000';

export function element(overrides: Partial<SemanticElement> & { ref: string }): SemanticElement {
  return {
    tag: 'button', role: 'button', name: null, label: null, testId: null, domId: null, href: null,
    actionAnchor: null, fieldName: null, inputType: null, visible: true, enabled: true,
    ...overrides,
  };
}

export function control(overrides: Partial<ControlDescriptor> = {}): ControlDescriptor {
  return { labels: [], testId: null, domId: null, element: null, event: null, actionAnchor: null, href: null, ...overrides };
}

export function snapshot(overrides: Partial<SemanticSnapshot> = {}): SemanticSnapshot {
  const path = overrides.path ?? '/';
  return {
    url: `${ORIGIN}${path}`, path, title: null, headings: [], elements: [], sdkStates: [], requests: [], errorCount: 0,
    ...overrides,
  };
}

export function state(overrides: Partial<ExecutableState> & { key: string }): ExecutableState {
  return {
    name: overrides.key, role: 'NORMAL', terminalKind: null, routePatterns: [], requiredElements: [], optionalElements: [],
    sdkStateSignals: [overrides.key], expectedApi: [], codeRefs: [], derivation: 'RESOLVED',
    ...overrides,
  };
}

export function transition(overrides: Partial<ExecutableTransition> & { id: string; from: string; to: string }): ExecutableTransition {
  return {
    action: overrides.id, control: null, inputs: [], actionClass: 'CLIENT_STATE_MUTATION', expectedApi: [], codeRefs: [], derivation: 'RESOLVED',
    ...overrides,
  };
}

export function limits(overrides: Partial<AutomationLimits> = {}): AutomationLimits {
  return { ...AutomationLimitsSchema.parse({}), ...overrides };
}

/**
 * A small LMS-shaped Flow: COURSE_DETAILS -> (Create Exam) -> EXAM_FORM -> (Submit) -> EXAM_CREATED.
 * EXAM_FORM can also fail into EXAM_ERROR. Routes and controls are what compile would derive.
 */
export function lmsContract(): ExecutableContract {
  return {
    flowVersionId: 'flow-v1',
    flowHash: 'hash',
    analysisIdentity: 'analysis-1',
    initialStateKey: 'course_details',
    states: [
      state({ key: 'course_details', role: 'INITIAL', routePatterns: ['/courses/{param}'] }),
      state({ key: 'exam_form', routePatterns: ['/courses/{param}/exams/new'] }),
      state({ key: 'exam_created', role: 'TERMINAL', terminalKind: 'SUCCESS', routePatterns: ['/courses/{param}/exams/{param}'] }),
      state({ key: 'exam_error', role: 'TERMINAL', terminalKind: 'FAILURE', routePatterns: ['/courses/{param}/exams/error'] }),
    ],
    transitions: [
      transition({
        id: 't-create', from: 'course_details', to: 'exam_form', action: 'Create Exam',
        control: control({ labels: ['Create Exam'], element: 'button', event: 'onClick' }),
        actionClass: 'CLIENT_STATE_MUTATION',
      }),
      transition({
        id: 't-submit', from: 'exam_form', to: 'exam_created', action: 'Submit exam',
        control: control({ labels: ['Save exam'], testId: 'submit-exam', element: 'button', event: 'onSubmit' }),
        inputs: [{ name: 'title', label: 'Title', dataKey: 'examTitle' }],
        actionClass: 'SERVER_MUTATION',
        expectedApi: [{ method: 'POST', route: '/api/exams', expectStatus: null }],
      }),
      transition({
        id: 't-fail', from: 'exam_form', to: 'exam_error', action: 'Submit invalid',
        control: control({ labels: ['Submit invalid'] }),
        actionClass: 'SERVER_MUTATION',
      }),
    ],
  };
}

export interface FakePage {
  path: string;
  /** Full URL when the page is not on the application's origin. */
  url?: string;
  /** SDK state reported when the page is entered. */
  sdkState?: string;
  title?: string | null;
  headings?: string[];
  /** Requests the page reports having made. */
  requests?: ObservedRequest[];
  elements: SemanticElement[];
}

export interface FakeAppOptions {
  pages: Record<string, FakePage>;
  start: string;
  /** click ref -> page key to move to. A missing entry means the click does nothing. */
  clicks: Record<string, string>;
  /** Refs whose click throws. */
  failingClicks?: string[];
  data?: Record<string, { value: string; secret: boolean }>;
  health?: () => 'OK' | 'APPLICATION_CRASHED' | 'BROWSER_CRASHED';
  seekInitial?: () => Promise<SemanticSnapshot | null>;
  /** Answers a step that needs a person. The app is passed so a test can play the person (`app.goto`). */
  handOver?: (request: StepHandOver, app: FakeApp) => Promise<'DONE' | 'CANCELLED' | 'TIMED_OUT'> | 'DONE' | 'CANCELLED' | 'TIMED_OUT';
  /** Clock advanced by `settle`, so duration budgets are testable without sleeping. */
  clockStepMs?: number;
}

export class FakeApp implements AutomationPorts {
  readonly events: AutomationEvent[] = [];
  readonly actions: AutomationAction[] = [];
  private page: string;
  private sdk: string[] = [];
  private clock = 1_000;
  cancelledFlag = false;

  readonly health: AutomationPorts['health'];
  readonly seekInitial: AutomationPorts['seekInitial'];
  readonly data: AutomationPorts['data'];
  readonly handOver: AutomationPorts['handOver'];
  /** Every step a person was asked about, in order. */
  readonly handOvers: StepHandOver[] = [];

  constructor(private readonly options: FakeAppOptions) {
    this.page = options.start;
    this.enter(options.start);
    this.health = options.health ? async () => options.health!() : undefined;
    this.seekInitial = options.seekInitial;
    this.data = options.data ? (key: string) => options.data![key] : undefined;
    this.handOver = options.handOver
      ? async (request) => {
          this.handOvers.push(request);
          return options.handOver!(request, this);
        }
      : undefined;
  }

  /** What a person doing something in the browser looks like to the run: the page changes without an action of ours. */
  goto(key: string): void {
    this.enter(key);
  }

  private enter(key: string): void {
    this.page = key;
    const page = this.options.pages[key];
    this.sdk = page?.sdkState ? [page.sdkState] : [];
  }

  private view(): SemanticSnapshot {
    const page = this.options.pages[this.page]!;
    return snapshot({
      path: page.path, ...(page.url ? { url: page.url } : {}), elements: page.elements, sdkStates: [...this.sdk],
      ...(page.title !== undefined ? { title: page.title } : {}), ...(page.headings ? { headings: page.headings } : {}), ...(page.requests ? { requests: page.requests } : {}),
    });
  }

  async snapshot(): Promise<SemanticSnapshot> {
    return this.view();
  }

  async act(action: AutomationAction): Promise<ActionOutcome> {
    this.actions.push(action);
    if (action.kind === 'CLICK') {
      if (this.options.failingClicks?.includes(action.ref)) return { ok: false, error: 'element detached' };
      const target = this.options.clicks[action.ref];
      if (target) this.enter(target);
    }
    return { ok: true };
  }

  async settle(): Promise<SemanticSnapshot> {
    this.clock += this.options.clockStepMs ?? 10;
    return this.view();
  }

  emit(event: AutomationEvent): void {
    this.events.push(event);
  }

  now(): number {
    return this.clock;
  }

  cancelled = (): boolean => this.cancelledFlag;

  get eventTypes(): string[] {
    return this.events.map((event) => event.type);
  }
}

/** The happy-path LMS app that matches `lmsContract`. */
export function lmsApp(overrides: Partial<FakeAppOptions> = {}): FakeApp {
  return new FakeApp({
    start: 'details',
    pages: {
      details: {
        path: '/courses/7', sdkState: 'course_details',
        elements: [element({ ref: 'e-create', name: 'Create Exam', role: 'button' })],
      },
      form: {
        path: '/courses/7/exams/new', sdkState: 'exam_form',
        elements: [
          element({ ref: 'e-title', tag: 'input', role: 'textbox', label: 'Title', fieldName: 'title', name: 'Title' }),
          element({ ref: 'e-save', name: 'Save exam', testId: 'submit-exam', role: 'button' }),
          element({ ref: 'e-invalid', name: 'Submit invalid', role: 'button' }),
        ],
      },
      created: { path: '/courses/7/exams/42', sdkState: 'exam_created', elements: [] },
      error: { path: '/courses/7/exams/error', sdkState: 'exam_error', elements: [] },
    },
    clicks: { 'e-create': 'form', 'e-save': 'created', 'e-invalid': 'error' },
    data: { examTitle: { value: 'Automated QA Exam', secret: false } },
    ...overrides,
  });
}
