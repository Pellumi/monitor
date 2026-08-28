import type { Metadata } from "next";
import Link from "next/link";
import { getOrderedPlans } from "@sots/shared";
import { PricingControls } from "@/components/pricing-controls";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tellann.co";

export const metadata: Metadata = {
  title: "Tellann Pricing — Free, Local, Solo, Team & Enterprise Plans",
  description:
    "Compare Tellann plans for individual developers, QA teams and engineering organizations. Start free and scale into local project intelligence, automated instrumentation, collaboration and enterprise governance.",
  alternates: { canonical: "/pricing" },
};

const decisionPaths = [
  [
    "I am evaluating Tellann",
    "Free",
    "Core behavioral QA for one application.",
  ],
  // [
  //   "I want local project intelligence",
  //   "Local",
  //   "Document and project intent in a local-first workflow.",
  // ],
  [
    "I need automated instrumentation",
    "Solo",
    "Advanced individual workflows and automation.",
  ],
  [
    "My team needs to collaborate",
    "Team",
    "Shared dashboards, governance, and RBAC.",
  ],
  [
    "We need APIs and auditability",
    "Business",
    "Programmatic access, audit logs, and priority processing.",
  ],
  [
    "We need infrastructure control",
    "Enterprise",
    "Identity, hosting, residency, and negotiated controls.",
  ],
];

const upgradePath = [
  ["Free", "I need Tellann to understand project intent."],
  ["Local", "I want automated instrumentation."],
  ["Solo", "I need collaboration."],
  ["Team", "I need APIs, audit, and governance."],
  ["Business", "I need infrastructure and identity control."],
  ["Enterprise", "Custom infrastructure and support."],
];

const faqs = [
  [
    "Can I use Tellann for free?",
    "Yes. Free includes one application, one user, core behavioral QA capabilities, 1 GB storage, and 14-day retention.",
  ],
  [
    "What is the Local plan?",
    "Local adds project and document intelligence for Nigerian developers working through Tellann Desktop. It sits between Free and Solo.",
  ],
  [
    "Does Local mean Tellann is completely offline?",
    "No. Local uses a hybrid architecture: approved source and project analysis happens locally while selected Tellann cloud services remain available.",
  ],
  [
    "Does Tellann upload my source code?",
    "Source analysis is local-first. Only approved derived context is sent through Tellann workflows; secrets and sensitive values should remain excluded.",
  ],
  [
    "What happens when I need more applications?",
    "Move to the next plan when you need higher application, user, storage, environment, or retention limits.",
  ],
  [
    "Can I cancel or downgrade?",
    "Billing changes are managed from the Tellann application. The final cancellation and downgrade policy will be shown before you confirm a billing change.",
  ],
  [
    "Do you charge per event?",
    "No. Current pricing is based primarily on applications, users, storage, and retention—not event volume.",
  ],
  [
    "Can Tellann be self-hosted?",
    "Yes. Self-hosted deployments are available with Enterprise.",
  ],
  [
    "Which plan supports automated instrumentation?",
    "Automated instrumentation begins with Solo and is included in higher plans.",
  ],
  [
    "Which plan supports team collaboration?",
    "Shared collaboration and governance begin with Team.",
  ],
];

export default function PricingPage() {
  const plans = getOrderedPlans();
  const offers = plans
    .filter((plan) => plan.pricing.monthlyUsd !== null)
    .map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      price: String((plan.pricing.monthlyUsd ?? 0) / 100),
      priceCurrency: "USD",
    }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Tellann",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web, Windows, macOS, Linux",
    url: `${siteUrl}/pricing`,
    offers,
  };

  return (
    <main className="pricing-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="pricing-hero">
        <p>Plans for every stage</p>
        <h1>
          Understand your software.
          <br />
          <span>Pay for what your team needs.</span>
        </h1>
        <div className="pricing-hero-bottom">
          <p>
            Start with core behavioral QA, then scale into local project
            intelligence, automated instrumentation, collaboration, governance,
            and infrastructure control.
          </p>
          <div>
            <span>Six plans</span>
            <span>No event-based billing</span>
            <span>14-day paid trials</span>
          </div>
        </div>
      </section>

      <section className="pricing-philosophy" aria-label="Pricing philosophy">
        <span>Transparent by design</span>
        <strong>Applications. Users. Storage. Retention.</strong>
        <p>
          Tellann’s current plans scale around understandable product limits—not
          opaque credits.
        </p>
      </section>

      <PricingControls plans={plans} />

      <section
        className="pricing-section pricing-decision"
        aria-labelledby="decision-heading"
      >
        <div className="pricing-section-heading">
          <p>Choose by outcome</p>
          <h2 id="decision-heading">Which plan is right for me?</h2>
        </div>
        <div className="pricing-decision-list">
          {decisionPaths.map(([need, plan, detail], index) => (
            <article key={plan}>
              <span>0{index + 1}</span>
              <p>{need}</p>
              <strong>{plan}</strong>
              <small>{detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section
        className="pricing-local"
        id="local-plan"
        aria-labelledby="local-heading"
      >
        <div>
          <p>Tellann Local</p>
          <h2 id="local-heading">Project intent meets observed behavior.</h2>
          <span>
            Local is for developers who want Tellann to understand more than
            what happens in the browser.
          </span>
        </div>
        <div className="pricing-local-flow" aria-label="Local architecture">
          {[
            "Approved project",
            "Local analysis",
            "Expected behavior",
            "Observed QA",
            "Reconciliation",
          ].map((item, index) => (
            <span key={item}>
              {item}
              {index < 4 ? <b aria-hidden="true">→</b> : null}
            </span>
          ))}
        </div>
        <div className="pricing-local-columns">
          <article>
            <p>What stays local</p>
            <strong>
              Project structure, source inspection, sensitive workspace context.
            </strong>
          </article>
          <article>
            <p>What Tellann derives</p>
            <strong>
              Expected workflows, states, intent, and comparison-ready context.
            </strong>
          </article>
          <article>
            <p>What Local is not</p>
            <strong>
              A completely offline deployment or a replacement for Tellann cloud
              services.
            </strong>
          </article>
        </div>
      </section>

      <section
        className="pricing-section pricing-limits"
        aria-labelledby="limits-heading"
      >
        <div className="pricing-section-heading">
          <p>Usage and limits</p>
          <h2 id="limits-heading">Know exactly where every plan changes.</h2>
        </div>
        <div className="pricing-limit-grid">
          {plans.map((plan) => (
            <article key={plan.type}>
              <p>{plan.name}</p>
              <span>
                <small>Apps</small>
                <strong>
                  {plan.limits.applications >= 9999
                    ? "Custom"
                    : plan.limits.applications}
                </strong>
              </span>
              <span>
                <small>Users</small>
                <strong>
                  {plan.limits.users >= 9999 ? "Custom" : plan.limits.users}
                </strong>
              </span>
              <span>
                <small>Storage</small>
                <strong>
                  {plan.limits.storageGb >= 9999
                    ? "Custom"
                    : `${plan.limits.storageGb} GB`}
                </strong>
              </span>
              <span>
                <small>Retention</small>
                <strong>
                  {plan.limits.retentionDays >= 9999
                    ? "Custom"
                    : `${plan.limits.retentionDays} days`}
                </strong>
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="pricing-band" aria-labelledby="reports-heading">
        <div>
          <p>Reports and exports</p>
          <h2 id="reports-heading">
            Share intelligence in the format your workflow needs.
          </h2>
        </div>
        <div>
          {plans.map((plan) => (
            <span key={plan.type}>
              <small>{plan.name}</small>
              <strong>{plan.exportFormats.join(" · ")}</strong>
            </span>
          ))}
        </div>
      </section>

      <section
        className="pricing-enterprise"
        aria-labelledby="enterprise-heading"
      >
        <div>
          <p>Enterprise</p>
          <h2 id="enterprise-heading">
            Control identity, infrastructure, governance, and support.
          </h2>
          <Link href="/contact?plan=enterprise">
            Talk to sales <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div>
          {[
            ["Identity", "SSO, SAML, OIDC, and advanced RBAC"],
            ["Infrastructure", "Self-hosting and negotiated residency"],
            [
              "Governance",
              "Audit logs, application permissions, and policy controls",
            ],
            [
              "Support",
              "Architecture assistance, dedicated success, and enterprise SLA",
            ],
          ].map(([title, copy]) => (
            <article key={title}>
              <p>{title}</p>
              <strong>{copy}</strong>
            </article>
          ))}
        </div>
      </section>

      <section
        className="pricing-section pricing-upgrade"
        aria-labelledby="upgrade-heading"
      >
        <div className="pricing-section-heading">
          <p>Upgrade path</p>
          <h2 id="upgrade-heading">Move when the reason becomes clear.</h2>
        </div>
        <div>
          {upgradePath.map(([plan, reason], index) => (
            <article key={plan}>
              <span>{plan}</span>
              <p>“{reason}”</p>
              {index < upgradePath.length - 1 ? (
                <b aria-hidden="true">↓</b>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="pricing-transparency">
        <p>Pricing transparency</p>
        <h2>No surprise event bills. No opaque AI credits.</h2>
        <span>
          Current plans are defined by applications, users, storage, retention,
          product capabilities, and support. If usage-based production
          intelligence is introduced later, Tellann will publish clear units and
          conversion rules.
        </span>
      </section>

      <section
        className="pricing-section pricing-faq"
        aria-labelledby="faq-heading"
      >
        <div className="pricing-section-heading">
          <p>FAQ</p>
          <h2 id="faq-heading">Questions before you choose.</h2>
        </div>
        <div>
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="pricing-final">
        <p>Start with one application</p>
        <h2>Choose the level of intelligence your work needs today.</h2>
        <div>
          <a
            href={`${process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com"}/auth/login?plan=free`}
          >
            Start free <span aria-hidden="true">→</span>
          </a>
          <Link href="/contact?plan=enterprise">Talk to sales</Link>
        </div>
      </section>
    </main>
  );
}
