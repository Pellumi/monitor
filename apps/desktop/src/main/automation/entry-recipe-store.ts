import { createHash } from "node:crypto";
import type { QAEvidenceEvent } from "@tellann/desktop-contracts";
import type { NavigationEdge } from "@tellann/automation-engine";
import type { KeyValueStore } from "./persona-store";
import { localKeyValueStore } from "./persona-store";

/**
 * Entry Recipes: a cached shortcut for the pre-boundary walk to a Flow's initial state.
 *
 * The first Automated Run for a repository has to work the walk out — from the navigation graph
 * (declared routes, guards, login) or, when the framework is not one the analyzer covers, from
 * what a person actually clicked on an earlier Guided run of the same Flow. Either way, once a
 * path has been used successfully it is worth remembering: reusing it removes the whole pre-boundary
 * search from every later run, not just its outcome.
 *
 * A recipe is a hint, never an authority. It is keyed to the exact repository state, persona and
 * Flow version it was recorded for, and `replayEntryRecipe` (in `@tellann/automation-engine`)
 * re-checks every step's action class against the current environment's policy and fails cleanly
 * on the first mismatch, so a caller can fall back to a full search rather than trust a stale path.
 * Login is never represented by a recipe — see `recipeFromGuidedRunEvidence` — so a Flow whose
 * initial state sits behind a login is never reached by skipping it.
 */
export interface EntryRecipe {
  applicationId: string;
  flowVersionId: string;
  /** Null for a run with no persona (a guest-only Flow). */
  personaId: string | null;
  repoSnapshotHash: string;
  lockfileHash: string;
  steps: NavigationEdge[];
  recordedAt: string;
  /** How the recipe was produced: from the navigation graph succeeding once, or salvaged from a Guided run. */
  source: "AUTOMATED_RUN" | "GUIDED_RUN";
}

export interface EntryRecipeIdentity {
  applicationId: string;
  flowVersionId: string;
  personaId: string | null;
  repoSnapshotHash: string;
  lockfileHash: string;
}

const RECIPE_PREFIX = "automation-entry-recipe:";

/**
 * One recipe per exact combination. Any one of these changing (a new commit, a changed lockfile, a
 * different persona, a revised Flow version) means the path that used to work might not, so it is
 * simplest to key on all of them together rather than try to guess which change invalidates it.
 */
function recipeKey(identity: EntryRecipeIdentity): string {
  const digest = createHash("sha256")
    .update(JSON.stringify([
      identity.applicationId, identity.flowVersionId, identity.personaId,
      identity.repoSnapshotHash, identity.lockfileHash,
    ]))
    .digest("hex");
  return `${RECIPE_PREFIX}${identity.applicationId}:${digest}`;
}

export function getEntryRecipe(identity: EntryRecipeIdentity, store: KeyValueStore = localKeyValueStore): EntryRecipe | null {
  return store.read<EntryRecipe>(recipeKey(identity));
}

export function saveEntryRecipe(recipe: EntryRecipe, store: KeyValueStore = localKeyValueStore): void {
  store.write(recipeKey(recipe), recipe);
}

export function deleteEntryRecipe(identity: EntryRecipeIdentity, store: KeyValueStore = localKeyValueStore): void {
  store.delete(recipeKey(identity));
}

/**
 * Derive an Entry Recipe from a completed Guided run's own pre-boundary evidence: the routes it
 * visited and the controls a person clicked before the Flow's initial state was accepted. This is
 * the fallback path for a framework the navigation-graph extractors do not cover (Vue, Svelte, an
 * unsupported router) — Tellann cannot work the path out from code, but it can remember the one a
 * human already walked.
 *
 * Deliberately does not attempt to reconstruct a login: a click that fills no recognisable route
 * transition, or one recorded before any route is known, is dropped rather than guessed at, and
 * nothing here fills a form field. A Flow whose initial state sits behind a login still needs the
 * navigation graph's declared login edge; this recipe only ever replays plain navigation.
 */
export function recipeFromGuidedRunEvidence(events: QAEvidenceEvent[]): NavigationEdge[] {
  const sorted = [...events].sort((a, b) => a.localSequence - b.localSequence);
  const edges: NavigationEdge[] = [];
  let currentRoute: string | null = null;
  let pendingControl: ReturnType<typeof controlFromClickMetadata> = null;
  let sequence = 0;

  for (const event of sorted) {
    // Everything after the boundary is the Flow itself, not the path to it.
    if (event.scope !== "PRE_BOUNDARY") break;

    if (event.eventType === "QA_ROUTE_CHANGED") {
      const route = event.normalizedRoute ?? pathnameOf(event.pageUrl);
      if (!route) continue;
      if (pendingControl && currentRoute && currentRoute !== route) {
        edges.push({
          id: `recipe-${sequence++}`,
          from: currentRoute,
          to: route,
          kind: "CLICK",
          // Observed, not derived: this is exactly what a person already did, so it is read-only
          // by assumption. A Flow whose entry genuinely needs a mutating click is not one this
          // fallback can help with; the navigation graph is the path for that.
          actionClass: "READ",
          confidence: 0.99,
          control: pendingControl,
          guard: null,
          evidence: { file: "guided-run-recipe", symbol: null, line: null },
        });
      }
      pendingControl = null;
      currentRoute = route;
      continue;
    }

    if (event.eventType === "QA_CONTROL_CLICKED") {
      const control = controlFromClickMetadata(event.metadata);
      // Keep only the most recent click before the next route change: the one that actually caused it.
      if (control) pendingControl = control;
    }
  }

  return edges;
}

function controlFromClickMetadata(metadata: Record<string, unknown>): { labels: string[]; testId: string | null; domId: string | null; element: string | null; event: string; actionAnchor: null; href: null } | null {
  const testId = str(metadata.testId);
  const domId = str(metadata.id);
  const label = str(metadata.accessibleName);
  if (!testId && !domId && !label) return null;
  return { labels: label ? [label] : [], testId, domId, element: str(metadata.tag), event: "click", actionAnchor: null, href: null };
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function pathnameOf(pageUrl: string | null): string | null {
  if (!pageUrl) return null;
  try {
    return new URL(pageUrl).pathname;
  } catch {
    return null;
  }
}
