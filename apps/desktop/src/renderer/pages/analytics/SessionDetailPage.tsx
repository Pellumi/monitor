import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Page, LoadingState, Status } from "../../pages";
import { formatEnum } from "../../components/desktop-ui";
import { Film } from "lucide-react";

type TimelineEvent = { offset: number; eventType: string; timestamp: string; metadata?: Record<string, unknown> };

type SessionTimeline = {
  durationMs: number;
  eventCount: number;
  workflowPath: string[];
  timeline: TimelineEvent[];
  stateTransitions: Array<{ fromState: string | null; toState: string; action: string | null; offset: number }>;
  apiCalls: Array<{ endpoint: string; method: string; statusCode: number; durationMs: number; offset: number }>;
  errors: Array<{ eventType: string; message: string; offset: number }>;
};

const ERROR_EVENT_TYPES = new Set(["ERROR_EVENT", "ERROR_OCCURRED", "UNHANDLED_EXCEPTION", "SERVER_ERROR", "CLIENT_ERROR"]);

function eventTone(type: string): string {
  if (ERROR_EVENT_TYPES.has(type)) return "danger";
  if (type.startsWith("WORKFLOW_") || type.startsWith("STATE_") || type.startsWith("FLOW_")) return "progress";
  return "neutral";
}

export function SessionDetailPage() {
  const { sessionId } = useParams();
  const [timeline, setTimeline] = useState<SessionTimeline | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    window.tellann!.sessions.timeline(sessionId).then((data) => setTimeline(data as unknown as SessionTimeline)).catch(() => undefined);
    window.tellann!.sessions.replayManifest(sessionId).then((manifest) => setHasRecording(Boolean(manifest.available))).catch(() => undefined);
  }, [sessionId]);

  const openReplay = async () => {
    if (!sessionId) return;
    setOpening(true);
    try {
      await window.tellann!.sessions.openReplayWindow(sessionId);
    } finally {
      setOpening(false);
    }
  };

  if (!timeline) return <LoadingState />;

  return (
    <Page
      title="Session"
      description={`${Math.round(timeline.durationMs / 1000)}s · ${timeline.eventCount} events`}
      actions={
        hasRecording ? (
          <button type="button" className="button primary" onClick={openReplay} disabled={opening}>
            <Film size={14} /> {opening ? "Opening…" : "Watch replay"}
          </button>
        ) : undefined
      }
    >
      <div className="stack">
        {timeline.workflowPath.length ? (
          <section className="content-card">
            <h2>Workflow path</h2>
            <p className="muted">{timeline.workflowPath.join(" → ")}</p>
          </section>
        ) : null}

        <section className="content-card">
          <h2>Event timeline</h2>
          <div className="session-timeline">
            {timeline.timeline.map((event, index) => (
              <div className="session-timeline-row" key={index} data-tone={eventTone(event.eventType)}>
                <span className="session-timeline-dot" aria-hidden="true" />
                <span>{formatEnum(event.eventType)}</span>
                <span className="muted">{new Date(event.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </section>

        {timeline.apiCalls.length ? (
          <section className="content-card">
            <h2>API calls</h2>
            <div className="stack">
              {timeline.apiCalls.map((call, index) => (
                <div className="settings-row-head" key={index}>
                  <span>
                    {call.method} {call.endpoint}
                  </span>
                  <Status>{String(call.statusCode)}</Status>
                  <span className="muted">{call.durationMs}ms</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {timeline.errors.length ? (
          <section className="content-card">
            <h2>Errors</h2>
            <div className="stack">
              {timeline.errors.map((error, index) => (
                <div className="inline-error" role="alert" key={index}>
                  <span>{error.message}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Page>
  );
}
