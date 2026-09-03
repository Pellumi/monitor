"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export type ContactReason =
  | "sales"
  | "enterprise"
  | "support"
  | "partnership"
  | "press"
  | "security"
  | "privacy"
  | "general";

type Field = {
  name: string;
  label: string;
  kind?: "select" | "text";
  options?: string[];
  required?: boolean;
  placeholder?: string;
};
type ReasonConfig = {
  label: string;
  short: string;
  eyebrow: string;
  title: string;
  description: string;
  fields: Field[];
  messageLabel: string;
  warning?: string;
};

const reasons: Record<ContactReason, ReasonConfig> = {
  sales: {
    label: "Sales & Demo",
    short: "Evaluate Tellann for your team.",
    eyebrow: "Commercial",
    title: "Tell us what you're evaluating.",
    description:
      "Explore fit, pricing, implementation, or adoption with the product team.",
    messageLabel: "What are you looking to solve?",
    fields: [
      {
        name: "role",
        label: "Your role",
        kind: "select",
        options: [
          "Developer",
          "QA Engineer",
          "Engineering Manager",
          "Product",
          "Founder",
          "Other",
        ],
      },
      {
        name: "teamSize",
        label: "Team size",
        kind: "select",
        options: ["1", "2–10", "11–50", "51–200", "200+"],
      },
      {
        name: "plan",
        label: "Interested plan",
        kind: "select",
        options: [
          "Not sure",
          "Free",
          "Local",
          "Solo",
          "Team",
          "Business",
          "Enterprise",
        ],
      },
    ],
  },
  enterprise: {
    label: "Enterprise",
    short: "Security, scale, and deployment.",
    eyebrow: "Enterprise",
    title: "Tell us about your requirements.",
    description:
      "Discuss governance, identity, deployment, data control, and procurement needs.",
    messageLabel: "Tell us about your requirements",
    fields: [
      { name: "role", label: "Your role", required: true },
      { name: "organizationSize", label: "Organization size" },
      { name: "applications", label: "Number of applications" },
      {
        name: "requirement",
        label: "Primary requirement",
        kind: "select",
        required: true,
        options: [
          "SSO / Identity",
          "Security review",
          "Self hosting",
          "Private networking",
          "Data residency",
          "Custom retention",
          "Large-scale deployment",
          "Procurement",
          "Other",
        ],
      },
    ],
  },
  support: {
    label: "Technical Support",
    short: "Product, workspace, or SDK help.",
    eyebrow: "Support",
    title: "Give us the useful context.",
    description:
      "For product, SDK, integration, billing, and workspace questions.",
    messageLabel: "Describe the issue",
    warning:
      "Do not include passwords, API secrets, access tokens, private keys, payment information, or other sensitive credentials.",
    fields: [
      { name: "workspace", label: "Tellann workspace / organization" },
      { name: "application", label: "Application name" },
      {
        name: "issueCategory",
        label: "Issue category",
        kind: "select",
        required: true,
        options: [
          "Account",
          "Billing",
          "SDK",
          "Application integration",
          "Session recording",
          "Behavior Graph",
          "Reports",
          "Dashboard",
          "Other",
        ],
      },
      { name: "subject", label: "Subject", required: true },
      { name: "requestId", label: "Error ID / Request ID" },
    ],
  },
  partnership: {
    label: "Partnerships",
    short: "Build something useful together.",
    eyebrow: "Partnerships",
    title: "Tell us what you have in mind.",
    description:
      "Explore technology, ecosystem, integration, commercial, or community partnerships.",
    messageLabel: "Your proposal",
    fields: [
      {
        name: "partnershipType",
        label: "Partnership type",
        kind: "select",
        required: true,
        options: [
          "Technology",
          "Integration",
          "Commercial",
          "Community",
          "Education",
          "Other",
        ],
      },
      { name: "website", label: "Website", placeholder: "https://" },
    ],
  },
  press: {
    label: "Press & Media",
    short: "Interviews, product, and media.",
    eyebrow: "Press",
    title: "Help us understand your enquiry.",
    description:
      "For interviews, company information, product context, and media assets.",
    messageLabel: "Your enquiry",
    fields: [
      {
        name: "publication",
        label: "Publication / Organization",
        required: true,
      },
      {
        name: "enquiryType",
        label: "Enquiry type",
        kind: "select",
        options: [
          "Interview",
          "Product information",
          "Company information",
          "Media assets",
          "Other",
        ],
      },
      { name: "deadline", label: "Deadline", placeholder: "Optional" },
    ],
  },
  security: {
    label: "Security",
    short: "Report a security concern.",
    eyebrow: "Restricted routing",
    title: "Report a security concern.",
    description:
      "Security reports follow a separate review path from commercial requests.",
    messageLabel: "Technical description and reproduction steps",
    warning:
      "Do not access, modify, or retain data that does not belong to you while investigating. Do not include credentials or exploit secrets in this form.",
    fields: [
      {
        name: "component",
        label: "Affected product / component",
        required: true,
      },
      { name: "subject", label: "Issue summary", required: true },
      { name: "impact", label: "Potential impact", required: true },
    ],
  },
  privacy: {
    label: "Privacy",
    short: "Data handling, access, or deletion.",
    eyebrow: "Separate routing",
    title: "Start a privacy request.",
    description:
      "Ask about data handling, retention, access, export, deletion, or privacy controls.",
    messageLabel: "Tell us about the request",
    fields: [
      {
        name: "requestType",
        label: "Request type",
        kind: "select",
        required: true,
        options: [
          "Privacy question",
          "Access request",
          "Export request",
          "Deletion request",
          "Retention question",
          "Privacy complaint",
          "Other",
        ],
      },
      { name: "workspace", label: "Account / workspace" },
    ],
  },
  general: {
    label: "General Enquiry",
    short: "Something else? Start here.",
    eyebrow: "General",
    title: "Send us the context.",
    description:
      "If none of the other paths fit, we'll route your question from here.",
    messageLabel: "Message",
    fields: [{ name: "subject", label: "Subject", required: true }],
  },
};

const reasonOrder = Object.keys(reasons) as ContactReason[];
const emptyValues: Record<string, string> = {
  firstName: "",
  lastName: "",
  email: "",
  organization: "",
  message: "",
  // Honeypot. Deliberately not a name any route asks for — it used to be
  // "website", which the partnership route genuinely collects, so every
  // partnership enquiry that filled it in was discarded as a bot.
  referralCode: "",
};

export function ContactWorkspace({
  initialReason,
  contactEndpoint,
  appUrl,
  docsUrl,
}: {
  initialReason: ContactReason;
  contactEndpoint?: string;
  appUrl: string;
  docsUrl: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reason, setReason] = useState(initialReason);
  const [values, setValues] = useState<Record<string, string>>(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error" | "unavailable"
  >("idle");
  // The server's own wording for a refusal it can explain better than we can
  // — a rate limit, say. Null falls back to the generic message below.
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    const urlReason = searchParams.get("reason")?.toLowerCase() as ContactReason | null;
    const targetReason =
      urlReason && reasonOrder.includes(urlReason)
        ? urlReason
        : initialReason;
    if (targetReason && targetReason !== reason) {
      setReason(targetReason);
      setErrors({});
      setStatus("idle");
    }
  }, [searchParams, initialReason, reason]);
  const config = reasons[reason];

  const requiredNames = useMemo(
    () => [
      "firstName",
      "lastName",
      "email",
      "message",
      ...config.fields
        .filter((field) => field.required)
        .map((field) => field.name),
      ...(reason === "enterprise" ? ["organization"] : []),
    ],
    [config, reason],
  );

  function chooseReason(next: ContactReason) {
    setReason(next);
    setErrors({});
    setStatus("idle");
    router.replace(`/contact?reason=${next}`, { scroll: false });
  }

  function update(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }));
    if (status !== "idle") {
      setStatus("idle");
      setServerError(null);
    }
  }

  function validate() {
    const next: Record<string, string> = {};
    requiredNames.forEach((name) => {
      if (!values[name]?.trim())
        next[name] =
          name === "message"
            ? "Tell us briefly what you need help with."
            : "This field is required.";
    });
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email))
      next.email = "Enter a valid email address.";
    if (values.message && values.message.trim().length < 20)
      next.message = "Add a little more detail so we can route this correctly.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function blurValidate(name: string) {
    if (requiredNames.includes(name) && !values[name]?.trim())
      setErrors((current) => ({
        ...current,
        [name]:
          name === "message"
            ? "Tell us briefly what you need help with."
            : "This field is required.",
      }));
    if (
      name === "email" &&
      values.email &&
      !/^\S+@\S+\.\S+$/.test(values.email)
    )
      setErrors((current) => ({
        ...current,
        email: "Enter a valid email address.",
      }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    if (values.referralCode) {
      // Same shape a real submission gets, so a bot learns nothing.
      setStatus("success");
      return;
    }
    if (!contactEndpoint) {
      setStatus("unavailable");
      return;
    }
    setStatus("submitting");
    try {
      const response = await fetch(contactEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: reason.toUpperCase(), ...values }),
      });

      if (response.ok) {
        setStatus("success");
        // A sent message should leave a clean form behind, or a second enquiry
        // silently resubmits the first one's text.
        setValues(emptyValues);
        setErrors({});
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; fields?: Record<string, string> }
        | null;

      // The server re-runs the same validation this form does. Showing its
      // verdict per field beats a generic failure the sender cannot act on.
      if (payload?.fields && Object.keys(payload.fields).length) {
        setErrors(payload.fields);
        setStatus("idle");
        return;
      }
      setServerError(payload?.message ?? null);
      setStatus("error");
    } catch {
      setServerError(null);
      setStatus("error");
    }
  }

  const controlProps = (name: string) => ({
    id: `contact-${name}`,
    name,
    value: values[name] || "",
    onChange: (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => update(name, event.target.value),
    onBlur: () => blurValidate(name),
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `contact-${name}-error` : undefined,
  });

  return (
    <section className="contact-workspace" id="contact-form">
      <div className="contact-shell">
        <div className="contact-section-heading">
          <p className="contact-kicker">Choose a path</p>
          <h2>What can we help with?</h2>
        </div>
        <div
          className="contact-reason-grid"
          role="list"
          aria-label="Contact reasons"
        >
          {reasonOrder.map((item, index) => (
            <button
              key={item}
              type="button"
              className={reason === item ? "is-active" : ""}
              onClick={() => chooseReason(item)}
              aria-pressed={reason === item}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{reasons[item].label}</b>
              <small>{reasons[item].short}</small>
              <i>→</i>
            </button>
          ))}
        </div>

        <div className="contact-form-frame">
          <aside>
            <p className="contact-kicker">{config.eyebrow}</p>
            <h3>{config.title}</h3>
            <p>{config.description}</p>
            {reason === "support" && (
              <div className="contact-context-link">
                <b>Already have an account?</b>
                <a href={appUrl}>Open authenticated support ↗</a>
                <a href={docsUrl}>Check documentation ↗</a>
              </div>
            )}
            {reason === "enterprise" && (
              <div className="contact-context-link">
                <b>Evaluating architecture?</b>
                <Link href="/security">Security →</Link>
                <Link href="/enterprise">Enterprise →</Link>
                <Link href="/enterprise/self-hosted">Deployment options →</Link>
              </div>
            )}
            <div className="contact-route-mark">
              <span>Route</span>
              <b>{reason.toUpperCase()}</b>
              <small>Only relevant context is requested.</small>
            </div>
          </aside>

          <form onSubmit={submit} noValidate>
            <div className="contact-field-row">
              <FieldControl
                label="First name"
                name="firstName"
                required
                error={errors.firstName}
              >
                <input
                  autoComplete="given-name"
                  {...controlProps("firstName")}
                />
              </FieldControl>
              <FieldControl
                label="Last name"
                name="lastName"
                required
                error={errors.lastName}
              >
                <input
                  autoComplete="family-name"
                  {...controlProps("lastName")}
                />
              </FieldControl>
            </div>
            <FieldControl
              label={
                reason === "general" || reason === "support"
                  ? "Email"
                  : "Work email"
              }
              name="email"
              required
              error={errors.email}
            >
              <input
                type="email"
                autoComplete="email"
                {...controlProps("email")}
              />
            </FieldControl>
            <FieldControl
              label={
                reason === "partnership"
                  ? "Company / Project"
                  : "Company / Organization"
              }
              name="organization"
              required={reason === "enterprise"}
              error={errors.organization}
            >
              <input
                autoComplete="organization"
                {...controlProps("organization")}
              />
            </FieldControl>
            <div className="contact-field-row contact-field-row-dynamic">
              {config.fields.map((field) => (
                <FieldControl
                  key={field.name}
                  label={field.label}
                  name={field.name}
                  required={field.required}
                  error={errors[field.name]}
                >
                  {field.kind === "select" ? (
                    <Select
                      value={values[field.name] || ""}
                      onValueChange={(val) => update(field.name, val)}
                    >
                      <SelectTrigger id={`contact-${field.name}`}>
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {field.options?.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  ) : (
                    <input
                      placeholder={field.placeholder}
                      {...controlProps(field.name)}
                    />
                  )}
                </FieldControl>
              ))}
            </div>
            <FieldControl
              label={config.messageLabel}
              name="message"
              required
              error={errors.message}
            >
              <textarea rows={7} {...controlProps("message")} />
            </FieldControl>
            {config.warning && (
              <p className="contact-warning">
                <b>Keep sensitive data out.</b> {config.warning}
              </p>
            )}
            <div className="contact-honeypot" aria-hidden="true">
              <label htmlFor="contact-referral-code">Leave this field empty</label>
              <input
                id="contact-referral-code"
                name="referralCode"
                tabIndex={-1}
                autoComplete="off"
                value={values.referralCode}
                onChange={(event) => update("referralCode", event.target.value)}
              />
            </div>
            <p className="contact-consent">
              By submitting, you agree that Tellann may use this information to
              respond to your enquiry. See our{" "}
              <Link href="/legal/privacy">Privacy Policy</Link>.
            </p>
            <button
              className="contact-submit"
              disabled={status === "submitting"}
            >
              {status === "submitting"
                ? "Sending…"
                : `Send ${config.label.toLowerCase()} request`}
              <span>→</span>
            </button>
            <div
              className={`contact-form-status ${status !== "idle" ? "is-visible" : ""}`}
              role="status"
              aria-live="polite"
            >
              {status === "success" && (
                <>
                  <b>Request received.</b>
                  <span>
                    Your enquiry has been passed to the appropriate Tellann
                    route.
                  </span>
                </>
              )}
              {status === "error" && (
                <>
                  <b>We couldn&apos;t send your request.</b>
                  <span>
                    {serverError ??
                      "Your message has not been submitted. Please try again."}
                  </span>
                </>
              )}
              {status === "unavailable" && (
                <>
                  <b>Delivery is not connected yet.</b>
                  <span>
                    Your message has not been sent or discarded. Configure
                    NEXT_PUBLIC_CONTACT_ENDPOINT to activate submissions.
                  </span>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function FieldControl({
  label,
  name,
  required,
  error,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="contact-field">
      <label htmlFor={`contact-${name}`}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {error && (
        <p id={`contact-${name}-error`} className="contact-field-error">
          {error}
        </p>
      )}
    </div>
  );
}
