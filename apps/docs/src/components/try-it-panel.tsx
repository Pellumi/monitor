"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle, ChevronDown, Loader2, Play, XCircle } from "lucide-react";

export interface TryItPanelProps {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  pathParams?: string[];
  defaultBody?: string;
  status?: "ga" | "beta" | "preview" | "planned";
}

export function TryItPanel({
  method,
  path,
  pathParams = [],
  defaultBody = "",
  status = "ga",
}: TryItPanelProps) {
  const gateway = process.env.NEXT_PUBLIC_API_GATEWAY_URL;
  const confirmationRef = useRef<HTMLDialogElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [credential, setCredential] = useState("");
  const [body, setBody] = useState(defaultBody);
  const [params, setParams] = useState<Record<string, string>>(() =>
    Object.fromEntries(pathParams.map((name) => [name, ""])),
  );
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    status: number;
    data: unknown;
    kind: "success" | "api-error" | "invalid-response";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasBody = ["POST", "PUT", "PATCH"].includes(method);
  const mutation = method !== "GET";
  const resolvedPath = useMemo(
    () =>
      pathParams.reduce(
        (value, name) =>
          value.replace(
            "{" + name + "}",
            encodeURIComponent(params[name] || ""),
          ),
        path,
      ),
    [params, path, pathParams],
  );
  const finalUrl = gateway ? gateway.replace(/\/$/, "") + resolvedPath : "";
  const missingParams = pathParams.filter((name) => !params[name]?.trim());

  function validate() {
    if (!gateway)
      return "Interactive requests are unavailable because the gateway origin is not configured.";
    if (status === "planned")
      return "Planned endpoints cannot execute requests.";
    if (missingParams.length)
      return "Complete required path values: " + missingParams.join(", ") + ".";
    if (!credential.trim())
      return "Enter a credential. It is kept in component memory only.";
    if (hasBody && body.trim()) {
      try {
        JSON.parse(body);
      } catch {
        return "The request body must be valid JSON.";
      }
    }
    return null;
  }

  function requestSend() {
    const issue = validate();
    if (issue) {
      setError(issue);
      return;
    }
    setError(null);
    if (mutation) confirmationRef.current?.showModal();
    else void send();
  }

  async function send() {
    confirmationRef.current?.close();
    const issue = validate();
    if (issue) {
      setError(issue);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 15000);
    setLoading(true);
    setResponse(null);
    setError(null);
    try {
      const result = await fetch(finalUrl, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: "Bearer " + credential.trim(),
          ...(hasBody && body.trim()
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body:
          hasBody && body.trim() ? JSON.stringify(JSON.parse(body)) : undefined,
      });
      const raw = await result.text();
      let data: unknown = raw;
      let kind: "success" | "api-error" | "invalid-response" = result.ok
        ? "success"
        : "api-error";
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          if (
            (result.headers.get("content-type") || "").includes(
              "application/json",
            )
          )
            kind = "invalid-response";
        }
      }
      setResponse({ status: result.status, data, kind });
    } catch (requestError) {
      const message =
        requestError instanceof Error && requestError.name === "AbortError"
          ? "Request cancelled or timed out."
          : "Network request failed. Check connectivity and the configured gateway.";
      setError(message);
    } finally {
      window.clearTimeout(timeout);
      abortRef.current = null;
      setLoading(false);
    }
  }

  return (
    <section
      className="docs-try-panel"
      aria-label={"Try " + method + " " + path}
    >
      <button
        type="button"
        className="docs-try-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Play aria-hidden="true" />
        <span>Try this request</span>
        <small>{method}</small>
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        <div className="docs-try-content">
          {!gateway ? (
            <p className="docs-try-notice">
              Interactive requests are disabled until{" "}
              <code>NEXT_PUBLIC_API_GATEWAY_URL</code> is configured. Static
              examples remain available.
            </p>
          ) : null}
          <label>
            Credential
            <input
              type="password"
              autoComplete="off"
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              placeholder="Enter for this request only"
            />
          </label>
          {pathParams.map((name) => (
            <label key={name}>
              {name}
              <input
                value={params[name]}
                required
                onChange={(event) =>
                  setParams((current) => ({
                    ...current,
                    [name]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
          {hasBody ? (
            <label>
              JSON body
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                spellCheck={false}
              />
            </label>
          ) : null}
          <div className="docs-try-url">
            <span>Final URL</span>
            <code>
              {finalUrl || "Gateway not configured"}
              {missingParams.length
                ? " — missing " + missingParams.join(", ")
                : ""}
            </code>
          </div>
          {error ? (
            <p className="docs-try-state docs-try-error">
              <XCircle aria-hidden="true" />
              {error}
            </p>
          ) : null}
          {response ? (
            <div className={"docs-try-response docs-try-" + response.kind}>
              <p>
                {response.kind === "success" ? (
                  <CheckCircle aria-hidden="true" />
                ) : (
                  <XCircle aria-hidden="true" />
                )}{" "}
                HTTP {response.status}
              </p>
              <pre>
                {typeof response.data === "string"
                  ? response.data
                  : JSON.stringify(response.data, null, 2)}
              </pre>
            </div>
          ) : null}
          <div className="docs-try-actions">
            <button
              type="button"
              onClick={requestSend}
              disabled={loading || status === "planned" || !gateway}
            >
              {loading ? (
                <Loader2 aria-hidden="true" className="spin" />
              ) : (
                <Play aria-hidden="true" />
              )}{" "}
              Send request
            </button>
            {loading ? (
              <button type="button" onClick={() => abortRef.current?.abort()}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <dialog ref={confirmationRef} className="docs-confirm-dialog">
        <form method="dialog">
          <h3>Confirm API mutation</h3>
          <p>This request can change data. Review it before sending.</p>
          <dl>
            <dt>Method</dt>
            <dd>{method}</dd>
            <dt>Final URL</dt>
            <dd>
              <code>{finalUrl}</code>
            </dd>
            <dt>Payload</dt>
            <dd>
              {hasBody && body.trim()
                ? body.length + " characters of JSON"
                : "No request body"}
            </dd>
          </dl>
          <div>
            <button value="cancel">Cancel</button>
            <button type="button" onClick={() => void send()}>
              Confirm and send
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
