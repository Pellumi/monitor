import { AIFlowDraft } from '../schemas';

export interface GenerateFlowInput {
  prompt: string;
  domainKey: string;
  productDescription: string;
}

export interface AIProvider {
  name: string;
  model: string;
  generateFlowDraft(input: GenerateFlowInput): Promise<AIFlowDraft>;
}
