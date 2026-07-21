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
