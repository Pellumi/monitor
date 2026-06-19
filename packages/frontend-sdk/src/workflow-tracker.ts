import { v4 as uuidv4 } from 'uuid';

interface InFlightWorkflow {
  name: string;
  startedAt: number;
}

export class WorkflowTracker {
  private workflows = new Map<string, InFlightWorkflow>();

  start(name: string): string {
    const id = uuidv4();
    this.workflows.set(id, {
      name,
      startedAt: Date.now()
    });
    return id;
  }

  complete(workflowId: string): { name: string; durationMs: number } | null {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;
    this.workflows.delete(workflowId);
    return {
      name: workflow.name,
      durationMs: Date.now() - workflow.startedAt
    };
  }

  fail(workflowId: string): { name: string; durationMs: number } | null {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;
    this.workflows.delete(workflowId);
    return {
      name: workflow.name,
      durationMs: Date.now() - workflow.startedAt
    };
  }

  abandon(workflowId: string): void {
    this.workflows.delete(workflowId);
  }
}
