"use client";

import { useState, type FormEvent } from "react";

export function ChangelogSubscribeForm() {
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
    <>
      <form className="changelog-subscribe-form" onSubmit={submit} noValidate>
        <label className="changelog-visually-hidden" htmlFor="changelog-subscribe-email">
          Email address
        </label>
        <input
          id="changelog-subscribe-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status !== "idle") setStatus("idle");
          }}
        />
        <button type="submit" className="changelog-subscribe-submit">
          Subscribe
        </button>
        {status === "success" ? (
          <p className="changelog-subscribe-status is-success" role="status">
            You&rsquo;re on the list. We&rsquo;ll only email when something ships.
          </p>
        ) : status === "error" ? (
          <p className="changelog-subscribe-status is-error" role="alert">
            Enter a valid email address.
          </p>
        ) : (
          <p className="changelog-subscribe-status">
            No spam. Unsubscribe anytime. See our{" "}
            <a href="/privacy">privacy policy</a>.
          </p>
        )}
      </form>
      <p className="changelog-rss-note">
        Prefer RSS? Subscribe at <code>/changelog/feed.xml</code>.
      </p>
    </>
  );
}
