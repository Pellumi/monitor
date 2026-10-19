import { ZodType } from 'zod';
import { AIFlowDraft } from '../schemas';

export interface GenerateFlowInput {
  prompt: string;
  domainKey: string;
  productDescription: string;
}

export interface GenerateStructuredInput<T> {
  prompt: string;
  schema: ZodType<T>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /**
   * Ceiling on the model's own output for this call.
   *
   * A structured response is not a fixed size: one mapping with a rationale is a
   * few hundred tokens, and a caller that asks about fifty of them at once needs
   * fifty times the room. Left to a single provider-wide constant, the larger
   * call is silently truncated mid-JSON and fails to parse — which reads as the
   * model being unable to answer rather than never having been allowed to.
   */
  maxOutputTokens?: number;
  /**
   * Images to send alongside the prompt.
   *
   * Only for the handful of questions a picture genuinely answers better than words — which control a person
   * would press when two are described identically in the markup. A provider that cannot take images ignores
   * them and answers from the prompt alone, so a caller is never left with no answer because of them.
   */
  images?: Array<{ mimeType: string; base64: string }>;
  repairPrompt?: (invalidText: string, validationErrors: string) => string;
}

export interface StructuredGenerationResult<T> {
  data: T;
  rawText: string;
  repaired: boolean;
}

export interface AIProvider {
  name: string;
  model: string;
  generateFlowDraft(input: GenerateFlowInput): Promise<AIFlowDraft>;
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<StructuredGenerationResult<T>>;
}
