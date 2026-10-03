import { NextResponse } from "next/server";

const MAX_BODY_BYTES = 16_000;
const UPSTREAM_TIMEOUT_MS = 10_000;

function contactUpstream(): string | null {
  const configured =
    process.env.CONTACT_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL?.trim() ||
    (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:3000" : "");

  if (!configured) return null;
  return configured.replace(/\/$/, "").endsWith("/contact")
    ? configured.replace(/\/$/, "")
    : `${configured.replace(/\/$/, "")}/contact`;
}

/**
 * Same-origin contact endpoint for the marketing form.
 *
 * The browser never needs to know where the private service boundary is, and
 * every submission still reaches onboarding-api through the public gateway,
 * where it is validated, rate-limited, persisted and announced by email.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (!contentType.includes("application/json") || contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "CONTACT_PAYLOAD_INVALID", message: "Please submit the form again." },
      { status: 400 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "CONTACT_PAYLOAD_INVALID", message: "Please submit the form again." },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json(
      { error: "CONTACT_PAYLOAD_INVALID", message: "Please submit the form again." },
      { status: 400 },
    );
  }

  const upstream = contactUpstream();
  if (!upstream) {
    console.error("[Marketing contact] CONTACT_API_URL is not configured");
    return NextResponse.json(
      {
        error: "CONTACT_DELIVERY_UNAVAILABLE",
        message: "Contact delivery is temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(upstream, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    const responsePayload = await response.json().catch(() => null);

    if (responsePayload && typeof responsePayload === "object") {
      return NextResponse.json(responsePayload, { status: response.status });
    }

    return NextResponse.json(
      {
        error: "CONTACT_DELIVERY_UNAVAILABLE",
        message: "Contact delivery is temporarily unavailable. Please try again shortly.",
      },
      { status: response.ok ? 502 : response.status },
    );
  } catch (error) {
    console.error("[Marketing contact] Upstream request failed", error);
    return NextResponse.json(
      {
        error: "CONTACT_DELIVERY_UNAVAILABLE",
        message: "Contact delivery is temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  }
}
