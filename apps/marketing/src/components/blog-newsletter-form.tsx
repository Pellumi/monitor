"use client";

import { useState, type FormEvent } from "react";

export function BlogNewsletterForm() {
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
    <form className="blog-newsletter-form" onSubmit={submit} noValidate>
      <label className="blog-visually-hidden" htmlFor="blog-newsletter-email">
        Email address
      </label>
      <input
        id="blog-newsletter-email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (status !== "idle") setStatus("idle");
        }}
      />
      <button type="submit" className="blog-newsletter-submit">
        Subscribe
      </button>
      {status === "success" ? (
        <p className="blog-newsletter-status is-success" role="status">
          You&rsquo;re on the list. Expect occasional, genuinely useful emails.
        </p>
      ) : status === "error" ? (
        <p className="blog-newsletter-status is-error" role="alert">
          Enter a valid email address.
        </p>
      ) : (
        <p className="blog-newsletter-status">
          No spam. Unsubscribe anytime. See our{" "}
          <a href="/privacy">privacy policy</a>.
        </p>
      )}
    </form>
  );
}
