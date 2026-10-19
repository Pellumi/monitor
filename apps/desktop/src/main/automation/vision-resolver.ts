import { z } from "zod";
import type { AmbiguityProposal, AmbiguityResolver, AmbiguitySituation, ResolverLocality } from "@tellann/automation-engine";

/**
 * A model asked, once, about the only two things the engine refuses to guess.
 *
 * Everything else about an Automated Run is deterministic, and that is not an accident: a run that decides what
 * to click from the code and the DOM can be replayed, audited step by step, and run with no model provider at
 * all. This is the one place that is relaxed, and it is relaxed as little as possible:
 *
 *   - It is asked **only after everything else has failed** — after the code-derived ranking tied, and after
 *     the rendered page failed to separate the candidates either (`visualTieBreak`). On a run where the code is
 *     good, it is never called at all.
 *   - It may **only choose from candidates the engine already found**. It cannot introduce a control, so it
 *     cannot widen what a run is willing to touch.
 *   - Its answer is **verified, not trusted**: `verifyControlProposal` requires the contract to agree on the
 *     destination and on the code mapping, caps an assisted state at MEDIUM confidence, and refuses outright to
 *     settle a step that can change server state on a tie the code cannot break. None of that is touched here.
 *   - It is **off unless somebody turns it on**, and it says where it ran, which goes into the provenance of
 *     every decision it influences.
 *
 * What it is sent is page metadata and, for a control tie, a masked crop of each candidate — never source code,
 * never a typed value, never a credential, never the page as a whole.
 */

/** What the model must answer with. Anything else is treated as no answer at all. */
const ProposalSchema = z.object({
  choice: z.string().min(1).max(200),
  destination: z.string().max(200).optional(),
  rationale: z.string().max(500).default(""),
});

/** The slice of the AI package this needs, so it can be tested without a provider. */
export interface StructuredAsker {
  name: string;
  generateStructured<T>(input: {
    prompt: string;
    schema: z.ZodType<T>;
    timeoutMs?: number;
    maxOutputTokens?: number;
    images?: Array<{ mimeType: string; base64: string }>;
  }): Promise<{ data: T }>;
}

export interface VisionResolverOptions {
  asker: StructuredAsker;
  /** Where the model runs. Recorded with every decision it influences; never inferred. */
  locality: ResolverLocality;
  /** Crops of the tied controls, by ref. Absent means the model is asked from the metadata alone. */
  cropFor?: (ref: string) => Promise<{ mimeType: string; base64: string } | null>;
  timeoutMs?: number;
}

/** A tie is between a handful of controls. More than this is not a tie, and no picture would settle it. */
const MAX_CANDIDATES = 6;
const DEFAULT_TIMEOUT_MS = 8_000;

export function createVisionResolver(options: VisionResolverOptions): AmbiguityResolver {
  return {
    id: `vision:${options.asker.name}`,
    locality: options.locality,
    async resolve(situation: AmbiguitySituation): Promise<AmbiguityProposal | null> {
      if (situation.candidates.length < 2 || situation.candidates.length > MAX_CANDIDATES) return null;
      const images: Array<{ mimeType: string; base64: string }> = [];
      if (situation.kind === "CONTROL" && options.cropFor) {
        for (const candidate of situation.candidates) {
          const crop = await options.cropFor(candidate.ref).catch(() => null);
          if (crop) images.push(crop);
        }
        // Half the pictures is worse than none: the model would be comparing one control it can see against one
        // it cannot, and would reliably pick the one it can.
        if (images.length !== situation.candidates.length) images.length = 0;
      }
      const { data } = await options.asker.generateStructured({
        prompt: promptFor(situation, images.length > 0),
        schema: ProposalSchema,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxOutputTokens: 300,
        ...(images.length > 0 ? { images } : {}),
      });
      return {
        choice: data.choice,
        ...(data.destination ? { destination: data.destination } : {}),
        rationale: data.rationale ?? "",
      };
    },
  };
}

/**
 * What the model is asked.
 *
 * Written as a question about what a person would do, not about what is correct: the engine already knows what
 * the Flow says, and is only missing which of two indistinguishable controls is the one on the page a person
 * would use. It is told it may refuse, because a refusal costs nothing — the run stops exactly as it would have
 * — while a guess that passes the verifier would click the wrong thing.
 */
export function promptFor(situation: AmbiguitySituation, withPictures: boolean): string {
  if (situation.kind === "STATE") {
    return [
      "A test is walking a declared user flow through a web application and cannot tell which step of the flow the current page is.",
      `The page is at ${situation.path}.`,
      situation.title ? `Its title is ${JSON.stringify(situation.title)}.` : null,
      situation.headings.length > 0 ? `Its headings are: ${situation.headings.map((heading) => JSON.stringify(heading)).join(", ")}.` : null,
      "",
      "These are the only steps it could be. Choose the one the page most plainly is:",
      ...situation.candidates.map((candidate) => `- ${candidate.stateKey}`),
      "",
      'Answer with JSON: {"choice": "<one of the keys above>", "rationale": "<one short sentence>"}.',
      'If the page does not plainly match one of them, answer {"choice": "", "rationale": "..."} and nothing will be decided.',
    ].filter(Boolean).join("\n");
  }

  return [
    "A test is walking a declared user flow through a web application. It needs to perform the step",
    `${JSON.stringify(situation.action ?? situation.transitionId)}, which should lead to ${JSON.stringify(situation.expectedState)}.`,
    "Several controls on the page are described identically in the markup, so it cannot tell which one to press.",
    "",
    "The candidates are:",
    ...situation.candidates.map((candidate, index) => [
      `- ref ${candidate.ref}`,
      candidate.role ? `role=${candidate.role}` : null,
      candidate.name ? `name=${JSON.stringify(candidate.name)}` : null,
      candidate.label ? `label=${JSON.stringify(candidate.label)}` : null,
      candidate.href ? `href=${candidate.href}` : null,
      candidate.testId ? `testId=${candidate.testId}` : null,
      withPictures ? `(picture ${index + 1})` : null,
    ].filter(Boolean).join(" ")),
    "",
    withPictures
      ? "The pictures are in the same order as the candidates: each shows that one control as it is drawn."
      : null,
    "Choose the control a person doing this step would press.",
    "",
    'Answer with JSON: {"choice": "<one of the refs above>", "destination": "<the step it leads to>", "rationale": "<one short sentence>"}.',
    'If you cannot tell, answer {"choice": "", "rationale": "..."} — the test will stop and ask a person, which is the right outcome when it is not clear.',
  ].filter(Boolean).join("\n");
}
