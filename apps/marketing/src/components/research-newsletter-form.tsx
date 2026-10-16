"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export function ResearchNewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStatus("error");
      return;
    }
    setStatus("success");
  }

  return (
    <form className="research-newsletter-form" onSubmit={submit} noValidate>
      <label className="research-visually-hidden" htmlFor="research-newsletter-email">
        Email address
      </label>
      <input
        id="research-newsletter-email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (status !== "idle") setStatus("idle");
        }}
      />
      <button type="submit" className="research-newsletter-submit">
        Subscribe
      </button>
      {status === "success" ? (
        <p className="research-newsletter-status is-success" role="status">
          You&rsquo;re subscribed. New publications and methodology notes arrive as they&rsquo;re ready — no fixed schedule.
        </p>
      ) : status === "error" ? (
        <p className="research-newsletter-status is-error" role="alert">
          Enter a valid email address.
        </p>
      ) : (
        <p className="research-newsletter-status">
          No spam. Unsubscribe anytime. See our{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      )}
    </form>
  );
}
