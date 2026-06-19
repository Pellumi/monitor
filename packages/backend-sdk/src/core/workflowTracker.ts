import { v4 as uuidv4 } from 'uuid';

interface InFlightWorkflow {
  name: string;
  startedAt: number;
  lastAccessedAt: number;
}

export class BackendWorkflowTracker {
  private workflows = new Map<string, InFlightWorkflow>();
  private readonly ttlMs = 30 * 60 * 1000; // 30 minutes idle timeout
  private readonly maxLifetimeMs = 2 * 60 * 60 * 1000; // 2 hours absolute limit
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodic cleanup every 5 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      // Allow Node process to exit if only this timer is active
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  start(name: string): string {
    this.cleanup(); // Clean up on start
    const id = uuidv4();
    this.workflows.set(id, {
      name,
      startedAt: Date.now(),
      lastAccessedAt: Date.now()
    });
    return id;
  }

  complete(workflowId: string): { name: string; durationMs: number } | null {
    this.cleanup();
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;
    
    this.workflows.delete(workflowId);
    return {
      name: workflow.name,
      durationMs: Date.now() - workflow.startedAt
    };
  }

  fail(workflowId: string): { name: string; durationMs: number } | null {
    this.cleanup();
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

  private cleanup(): void {
    const now = Date.now();
    for (const [id, workflow] of this.workflows.entries()) {
      const isIdleExpired = now - workflow.lastAccessedAt > this.ttlMs;
      const isAbsoluteExpired = now - workflow.startedAt > this.maxLifetimeMs;
      
      if (isIdleExpired || isAbsoluteExpired) {
        this.workflows.delete(id);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.workflows.clear();
  }
}
