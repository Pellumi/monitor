import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ContactWorkspace,
  type ContactReason,
} from "@/components/contact-workspace";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";
const docsUrl =
  process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.domain-name.com";

export const metadata: Metadata = {
  title: "Contact Tellann | Sales, Support & General Enquiries",
  description:
    "Contact Tellann for product questions, enterprise requirements, technical support, partnerships, media enquiries, security concerns or privacy requests.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact Tellann | Talk to the right team",
    description:
      "Route your Tellann question to sales, support, security, privacy, or the team best placed to help.",
    url: `${siteUrl}/contact`,
    type: "website",
  },
};

const validReasons = new Set<ContactReason>([
  "sales",
  "enterprise",
  "support",
  "partnership",
  "press",
  "security",
  "privacy",
  "general",
]);

type ContactPageProps = {
  searchParams: Promise<{ reason?: string; plan?: string }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = await searchParams;
  const requested = params.reason?.toLowerCase() as ContactReason | undefined;
  const initialReason: ContactReason =
    requested && validReasons.has(requested)
      ? requested
      : params.plan === "enterprise"
        ? "enterprise"
        : "sales";

  return (
    <main className="contact-page">
      <section className="contact-hero">
        <div className="contact-shell contact-hero-grid">
          <div>
            <p className="contact-kicker">Contact Tellann</p>
            <h1>
              Talk to the
              <br />
              right team.
            </h1>
          </div>
          <div className="contact-hero-copy">
            <p>
              Whether you&apos;re evaluating Tellann, working through an
              integration, exploring a partnership, or contacting us about
              security or privacy, we&apos;ll route your request appropriately.
            </p>
            <div className="contact-inline-links">
              <a href={appUrl}>
                Already use Tellann? <span>Get support ↗</span>
              </a>
              <a href={docsUrl}>
                Looking for documentation? <span>Read the docs ↗</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="min-h-[600px]" />}>
        <ContactWorkspace
          initialReason={initialReason}
          contactEndpoint={process.env.NEXT_PUBLIC_CONTACT_ENDPOINT}
          appUrl={appUrl}
          docsUrl={docsUrl}
        />
      </Suspense>

      <section className="contact-support">
        <div className="contact-shell contact-support-grid">
          <div>
            <p className="contact-kicker">Existing customers</p>
            <h2>Already using Tellann?</h2>
          </div>
          <div>
            <p>
              The fastest way to get help with a workspace, application, billing
              issue, or integration is through authenticated support.
            </p>
            <div className="contact-actions">
              <a className="contact-button contact-button-solid" href={appUrl}>
                Sign in for support <span>↗</span>
              </a>
              <a className="contact-button" href={docsUrl}>
                Read documentation <span>↗</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="contact-alternatives">
        <div className="contact-shell">
          <div className="contact-section-heading">
            <p className="contact-kicker">Self-service paths</p>
            <h2>Looking for something else?</h2>
          </div>
          <div className="contact-link-grid">
            <a href={docsUrl}>
              <b>Documentation</b>
              <span>Technical guides and SDK reference.</span>
              <i>↗</i>
            </a>
            <Link href="/security">
              <b>Security</b>
              <span>How Tellann protects application data.</span>
              <i>→</i>
            </Link>
            <Link href="/security/privacy">
              <b>Privacy</b>
              <span>What Tellann collects and excludes.</span>
              <i>→</i>
            </Link>
            <Link href="/careers">
              <b>Careers</b>
              <span>Interested in building Tellann?</span>
              <i>→</i>
            </Link>
            <Link href="/brand">
              <b>Brand</b>
              <span>Logos, product copy, and media assets.</span>
              <i>→</i>
            </Link>
          </div>
        </div>
      </section>

      <section className="contact-trust">
        <div className="contact-shell">
          <p className="contact-kicker">Security &amp; privacy</p>
          <div className="contact-trust-grid">
            <div>
              <h2>Sensitive questions take a separate path.</h2>
              <p className="mt-4">
                Security and privacy enquiries are routed separately from
                general commercial requests.
              </p>
            </div>
            <Link href="/contact?reason=security#contact-form">
              <span>01 / Security issue</span>
              <b>Report a concern or suspected vulnerability.</b>
              <i>→</i>
            </Link>
            <Link href="/contact?reason=privacy#contact-form">
              <span>02 / Privacy request</span>
              <b>Ask about access, export, deletion, or retention.</b>
              <i>→</i>
            </Link>
          </div>
        </div>
      </section>

      <section className="contact-expectations">
        <div className="contact-shell">
          <div className="contact-section-heading">
            <p className="contact-kicker">What happens next</p>
            <h2>Clear routing. Honest expectations.</h2>
          </div>
          <div className="contact-expectation-grid">
            <article>
              <span>01</span>
              <h3>Sales</h3>
              <p>
                Product and evaluation enquiries enter the commercial review
                queue.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Support</h3>
              <p>
                Existing customers should use authenticated support whenever
                available.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Security</h3>
              <p>
                Security submissions go directly to the appropriate restricted
                review process.
              </p>
            </article>
            <article>
              <span>04</span>
              <h3>Privacy</h3>
              <p>
                Privacy requests are handled separately from product and sales
                enquiries.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="contact-faq">
        <div className="contact-shell contact-faq-grid">
          <div>
            <p className="contact-kicker">Common questions</p>
            <h2>Before you send.</h2>
          </div>
          <div className="contact-faq-list">
            <details>
              <summary>
                Can I try Tellann without talking to sales?<span>+</span>
              </summary>
              <p>
                Yes. The Free plan is designed for evaluation and individual
                use. You can start without a sales process.
              </p>
            </details>
            <details>
              <summary>
                Where can I get SDK help?<span>+</span>
              </summary>
              <p>
                Start with the documentation. If you still need help, choose
                Technical Support above and include the framework and request ID
                when available.
              </p>
            </details>
            <details>
              <summary>
                I&apos;m interested in self-hosting. Who should I contact?
                <span>+</span>
              </summary>
              <p>
                Choose Enterprise. Self-hosting, private networking, SSO, and
                deployment controls are handled through the enterprise path.
              </p>
            </details>
            <details>
              <summary>
                Where should I report a security issue?<span>+</span>
              </summary>
              <p>
                Select Security above. Do not include credentials or access data
                that does not belong to you while investigating.
              </p>
            </details>
            <details>
              <summary>
                Can I request deletion or export of data?<span>+</span>
              </summary>
              <p>
                Yes. Select Privacy and choose the relevant request type. We
                only ask for the information needed to begin the request.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section className="contact-final">
        <div className="contact-shell">
          <p className="contact-kicker">Still not sure?</p>
          <h2>
            We&apos;ll route it
            <br />
            from here.
          </h2>
          <p>Choose General Enquiry and give us the context you have.</p>
          <Link
            className="contact-button contact-button-inverse"
            href="/contact?reason=general#contact-form"
          >
            Start a general enquiry <span>→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
