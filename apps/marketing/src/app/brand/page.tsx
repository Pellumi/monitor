import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandCopyButton } from "@/components/brand-copy-button";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";

export const metadata: Metadata = {
  title: "Tellann Brand — Logos, Colors & Brand Guidelines",
  description:
    "Official Tellann brand resources, including logo usage, colors, typography, product imagery, approved messaging, and downloadable media assets.",
  alternates: { canonical: "/brand" },
  openGraph: {
    title: "Tellann Brand — Logos, Colors & Brand Guidelines",
    description:
      "The public reference for representing Tellann clearly and consistently.",
    url: `${siteUrl}/brand`,
    type: "website",
  },
};

const essence = [
  ["Precise", "Every element should appear intentional."],
  ["Technical", "Tellann should feel native to engineering environments."],
  ["Controlled", "Information has hierarchy. Nothing competes unnecessarily."],
  [
    "Intelligent",
    "Complexity is exposed clearly, never hidden behind spectacle.",
  ],
];

const colors = [
  ["Pure Black", "#000000", "Primary dark canvas", "0, 0, 0"],
  ["Charcoal", "#262626", "Secondary surfaces", "38, 38, 38"],
  [
    "Neutral Accent",
    "#757575",
    "Metadata and inactive states",
    "117, 117, 117",
  ],
  ["Highlight White", "#FFFFFF", "Primary text and emphasis", "255, 255, 255"],
];

const interfaceColors = [
  ["Surface", "#131313"],
  ["Surface low", "#1B1B1B"],
  ["Surface high", "#2A2A2A"],
  ["On surface", "#E2E2E2"],
  ["On surface variant", "#C4C7C8"],
  ["Outline", "#8E9192"],
];

const messages = [
  [
    "One line",
    "Tellann is a behavioral quality intelligence platform for software teams.",
  ],
  [
    "Short",
    "Tellann observes application behavior, models software workflows, measures behavioral coverage, and helps engineering teams identify missing states, flows, and quality gaps.",
  ],
  [
    "Mission",
    "Help software teams discover, understand, and resolve quality issues before they impact users by transforming application behavior into continuously evolving quality intelligence.",
  ],
  [
    "Vision",
    "To become the intelligence layer that enables software applications to understand, evaluate, and communicate their own operational quality.",
  ],
];

export default function BrandPage() {
  return (
    <main className="brand-page">
      <nav className="brand-index" aria-label="Brand page sections">
        <div className="brand-shell">
          <span>Brand guide / 01</span>
          <div>
            <a href="#overview">Overview</a>
            <a href="#logo">Logo</a>
            <a href="#color">Color</a>
            <a href="#type">Typography</a>
            <a href="#voice">Voice</a>
            <a href="#downloads">Downloads</a>
          </div>
        </div>
      </nav>

      <section className="brand-hero" id="overview">
        <div className="brand-shell brand-hero-grid !pt-8">
          <div className="brand-hero-copy">
            <p className="brand-kicker">Tellann brand</p>
            <h1>
              Built to make
              <br />
              invisible behavior
              <br />
              <span>visible.</span>
            </h1>
            <p>
              These guidelines define how Tellann is represented across product,
              web, media, partnerships, documentation, and communications.
            </p>
            <div className="brand-actions">
              <a
                className="brand-button brand-button-solid"
                href="/logo_icon_text.svg"
                download
              >
                Download primary logo <span>↓</span>
              </a>
              <a className="brand-button" href="#logo">
                View usage guidelines <span>↓</span>
              </a>
            </div>
          </div>
          <div
            className="brand-hero-mark"
            aria-label="Official white Tellann horizontal logo"
          >
            {/* <div className="brand-orbit" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div> */}
            <Image
              src="/logo_icon_text.svg"
              alt="Tellann"
              width={1080}
              height={540}
              priority
            />
            <span>Primary lockup / white / SVG</span>
          </div>
        </div>
      </section>

      <section className="brand-quick">
        <div className="brand-shell brand-quick-grid">
          <a href="#logo">
            <span>01</span>
            <b>Logos</b>
            <small>Approved variants</small>
            <i>↓</i>
          </a>
          <a href="#color">
            <span>02</span>
            <b>Colors</b>
            <small>#000000 / #FFFFFF</small>
            <i>↓</i>
          </a>
          <a href="#type">
            <span>03</span>
            <b>Typography</b>
            <small>Human / Machine</small>
            <i>↓</i>
          </a>
          <a href="#downloads">
            <span>04</span>
            <b>Assets</b>
            <small>Current exports</small>
            <i>↓</i>
          </a>
        </div>
      </section>

      <section className="brand-essence">
        <div className="brand-shell">
          <header className="brand-section-head">
            <p className="brand-kicker">Brand essence</p>
            <h2>
              What Tellann
              <br />
              should feel like.
            </h2>
          </header>
          <div className="brand-essence-grid">
            {essence.map(([title, copy], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          <div className="brand-personality">
            <div>
              <p className="brand-kicker">We are</p>
              <p>
                Technical
                <br />
                Precise
                <br />
                Confident
                <br />
                Minimal
                <br />
                Evidence-driven
              </p>
            </div>
            <div>
              <p className="brand-kicker">We are not</p>
              <p>
                Sci-fi fantasy
                <br />
                Sterile
                <br />
                Loud
                <br />
                Decorative
                <br />
                Hype-driven
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="brand-logo" id="logo">
        <div className="brand-shell">
          <header className="brand-section-head">
            <p className="brand-kicker">Logo system</p>
            <h2>The Tellann mark.</h2>
            <p>
              Use the primary horizontal lockup by default. The symbol and
              wordmark are supporting variants for constrained, approved
              contexts.
            </p>
          </header>
          <div className="brand-lockup-primary">
            <div>
              <Image
                src="/logo_icon_text_black.svg"
                alt="Black Tellann primary horizontal logo"
                width={1080}
                height={540}
              />
            </div>
            <footer>
              <span>Primary horizontal lockup</span>
              <p>
                Default for navigation, press, partnerships, and documentation.
              </p>
              <a href="/logo_icon_text_black.svg" download>
                SVG ↓
              </a>
            </footer>
          </div>
          <div className="brand-logo-variants">
            <article className="is-dark">
              <span>Symbol / dark surface</span>
              <Image
                src="/logo_icon.svg"
                alt="White Tellann symbol"
                width={300}
                height={300}
              />
              <a href="/logo_icon.svg" download>
                SVG ↓
              </a>
            </article>
            <article className="is-light">
              <span>Symbol / light surface</span>
              <Image
                src="/logo_hex.svg"
                alt="Black Tellann symbol"
                width={300}
                height={300}
              />
              <a href="/logo_hex.svg" download>
                SVG ↓
              </a>
            </article>
            <article className="is-dark">
              <span>Wordmark / dark surface</span>
              <Image
                src="/logo_text.svg"
                alt="White Tellann wordmark"
                width={1080}
                height={540}
              />
              <a href="/logo_text.svg" download>
                SVG ↓
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className="brand-rules">
        <div className="brand-shell">
          <header className="brand-section-head">
            <p className="brand-kicker">Logo usage</p>
            <h2>Keep the mark intact.</h2>
          </header>
          <div className="brand-rule-grid">
            <article className="is-correct">
              <span>Correct / approved</span>
              <Image
                src="/logo_icon_text.svg"
                alt="Correct: approved white Tellann lockup"
                width={1080}
                height={540}
              />
              <p>
                Use approved monochrome files, preserve proportions, and
                maintain contrast.
              </p>
            </article>
            <article>
              <span>Incorrect / stretched</span>
              <div className="brand-misuse stretch">
                <Image
                  src="/logo_icon_text.svg"
                  alt="Incorrect: horizontally stretched Tellann logo"
                  width={1080}
                  height={540}
                />
              </div>
              <p>
                Never stretch, compress, rotate, outline, or reconstruct the
                mark.
              </p>
            </article>
            <article>
              <span>Incorrect / effects</span>
              <div className="brand-misuse glow">
                <Image
                  src="/logo_icon_text.svg"
                  alt="Incorrect: Tellann logo with glow effect"
                  width={1080}
                  height={540}
                />
              </div>
              <p>
                Never add gradients, glows, shadows, or recolor individual
                nodes.
              </p>
            </article>
          </div>
          <div className="brand-clear-space">
            <div>
              <p className="brand-kicker">Clear space</p>
              <h3>Give the mark room.</h3>
              <p>
                Keep a consistent exclusion zone around every lockup. Do not
                crowd the mark with type, imagery, borders, or another logo.
              </p>
              <small>
                Final production minimum-size measurements remain pending formal
                legibility testing.
              </small>
            </div>
            <div className="brand-clear-demo">
              <span>x</span>
              <span>x</span>
              <Image
                src="/logo_icon_text.svg"
                alt="Tellann logo clear-space demonstration"
                width={1080}
                height={540}
              />
              <span>x</span>
              <span>x</span>
            </div>
          </div>
        </div>
      </section>

      <section className="brand-color" id="color">
        <div className="brand-shell">
          <header className="brand-section-head">
            <p className="brand-kicker">Color system</p>
            <h2>
              Luminance is
              <br />
              the accent.
            </h2>
            <p>
              Tellann creates hierarchy through brightness, tonal separation,
              and deliberate contrast.
            </p>
          </header>
          <div className="brand-color-grid">
            {colors.map(([name, hex, use, rgb]) => (
              <article
                key={hex}
                style={{
                  background: hex,
                  color: hex === "#FFFFFF" ? "#000000" : "#FFFFFF",
                }}
              >
                <span>{name}</span>
                <div>
                  <b>{hex}</b>
                  <small>RGB {rgb}</small>
                  <p>{use}</p>
                  <BrandCopyButton value={hex} />
                </div>
              </article>
            ))}
          </div>
          <details className="brand-interface-colors">
            <summary>
              Interface neutrals <span>+</span>
            </summary>
            <div>
              {interfaceColors.map(([name, hex]) => (
                <article key={hex}>
                  <i style={{ background: hex }} />
                  <span>{name}</span>
                  <b>{hex}</b>
                </article>
              ))}
            </div>
            <p className="mt-4 pb-1">
              These support product interfaces. Semantic status colors are not
              external brand colors.
            </p>
          </details>
        </div>
      </section>

      <section className="brand-type" id="type">
        <div className="brand-shell">
          <header className="brand-section-head">
            <p className="brand-kicker">Typography</p>
            <h2>
              Human language.
              <br />
              Machine language.
            </h2>
          </header>
          <div className="brand-type-grid">
            <article>
              <header>
                <span>01 / Human layer</span>
                <b>Poppins</b>
              </header>
              <p className="brand-type-human">
                Understand how your software actually behaves.
              </p>
              <footer>
                <span>Headlines · body · navigation · guidance</span>
                <b>
                  ABCDEFGHIJKLMNOPQRSTUVWXYZ
                  <br />
                  abcdefghijklmnopqrstuvwxyz
                  <br />
                  0123456789
                </b>
              </footer>
            </article>
            <article>
              <header>
                <span>02 / Machine layer</span>
                <b>JetBrains Mono</b>
              </header>
              <p className="brand-type-machine">
                SESSION_STARTED
                <br />
                wf_checkout_01
                <br />
                coverage: 72%
              </p>
              <footer>
                <span>IDs · timestamps · events · metrics</span>
                <b>400–500 / technical data</b>
              </footer>
            </article>
          </div>
          <p className="brand-font-note">
            Font files are not included in Tellann asset downloads. Obtain
            Poppins and JetBrains Mono through their official distribution
            sources and licensing terms.
          </p>
        </div>
      </section>

      <section className="brand-visuals">
        <div className="brand-shell">
          <header className="brand-section-head">
            <p className="brand-kicker">Visual language</p>
            <h2>
              Technical without
              <br />
              becoming theatrical.
            </h2>
          </header>
          <div className="brand-visual-grid">
            <article>
              <span>Surface</span>
              <div className="brand-surface-stack">
                <i>LEVEL 02</i>
                <i>LEVEL 01</i>
                <i>LEVEL 00</i>
              </div>
              <h3>Depth through tone.</h3>
              <p>Use tonal separation and thin borders, not heavy shadows.</p>
            </article>
            <article>
              <span>Geometry</span>
              <div className="brand-geometry">
                <i />
                <i />
                <i />
              </div>
              <h3>Soft-technical.</h3>
              <p>
                Restrained radii, precise alignment, and shapes with purpose.
              </p>
            </article>
            <article>
              <span>Motion</span>
              <div className="brand-motion-demo">
                <i />
                <b />
                <i />
              </div>
              <h3>Reveal behavior.</h3>
              <p>Motion should explain state, transition, or progression.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="brand-product">
        <div className="brand-shell">
          <header className="brand-section-head">
            <p className="brand-kicker">Product representation</p>
            <h2>
              Show evidence,
              <br />
              not theatre.
            </h2>
            <p>
              Use current product views with realistic, non-sensitive demo data.
              Never fabricate metrics or present roadmap concepts as released
              functionality.
            </p>
          </header>
          <div className="brand-product-grid">
            {["Behavior Graph", "Session Replay", "Coverage", "QA Reports"].map(
              (name, index) => (
                <article key={name}>
                  <div
                    className={`brand-product-placeholder variant-${index + 1}`}
                  >
                    <span>Approved product visual</span>
                    <b>{name}</b>
                    <small>1600 × 1000 px placeholder</small>
                  </div>
                  <footer>
                    <span>{name}</span>
                    <small>Asset pending approved screenshot</small>
                  </footer>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="brand-voice" id="voice">
        <div className="brand-shell">
          <header className="brand-section-head">
            <p className="brand-kicker">Tone of voice</p>
            <h2>
              Calm. Precise.
              <br />
              Evidence-driven.
            </h2>
          </header>
          <div className="brand-voice-grid">
            <article>
              <span>Say what the product does.</span>
              <p>“Tellann maps observed application workflows.”</p>
              <small>Clear, grounded, and attributable.</small>
            </article>
            <article>
              <span>Distinguish evidence from inference.</span>
              <p>“Tellann observed seven checkout paths.”</p>
              <small>Make only the claim the evidence supports.</small>
            </article>
            <article className="is-avoid">
              <span>Avoid inflated claims.</span>
              <p>“AI autonomously tests your entire application.”</p>
              <small>Tellann is not magic. Do not present it that way.</small>
            </article>
          </div>
        </div>
      </section>

      <section className="brand-messaging">
        <div className="brand-shell">
          <header className="brand-section-head">
            <p className="brand-kicker">Approved messaging</p>
            <h2>How to describe Tellann.</h2>
          </header>
          <div className="brand-message-list">
            {messages.map(([label, text], index) => (
              <article key={label}>
                <span>
                  {String(index + 1).padStart(2, "0")} / {label}
                </span>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="brand-naming">
            <div>
              <p className="brand-kicker">Naming</p>
              <h3>Tellann</h3>
              <p>
                The public company and product name uses this capitalization.
              </p>
            </div>
            <div>
              <b>Correct</b>
              <span>Tellann</span>
              <b>Avoid</b>
              <span>TELLANN · TellAnn · Tell Ann · Tellann AI</span>
            </div>
          </div>
        </div>
      </section>

      <section className="brand-downloads" id="downloads">
        <div className="brand-shell">
          <header className="brand-section-head">
            <p className="brand-kicker">Approved assets</p>
            <h2>Use the current files.</h2>
            <p>
              Only published exports are available below. Broader press,
              screenshot, social, and guideline packages will appear when
              formally approved.
            </p>
          </header>
          <div className="brand-download-grid">
            <a href="/logo_icon_text.svg" download>
              <span>01 / Logo</span>
              <h3>White horizontal lockup</h3>
              <p>SVG · scalable vector</p>
              <b>Download ↓</b>
            </a>
            <a href="/logo_icon_text_black.svg" download>
              <span>02 / Logo</span>
              <h3>Black horizontal lockup</h3>
              <p>SVG · scalable vector</p>
              <b>Download ↓</b>
            </a>
            <a href="/logo_icon.svg" download>
              <span>03 / Icon</span>
              <h3>White Tellann symbol</h3>
              <p>SVG · scalable vector</p>
              <b>Download ↓</b>
            </a>
            <a href="/logo_icon.png" download>
              <span>04 / Icon</span>
              <h3>Tellann app icon</h3>
              <p>PNG · 3000 × 3000</p>
              <b>Download ↓</b>
            </a>
          </div>
          <p className="brand-version">
            Brand assets v1.0 <span>Updated Aug 2026</span>
          </p>
        </div>
      </section>

      <section className="brand-legal">
        <div className="brand-shell brand-legal-grid">
          <p className="brand-kicker">External use</p>
          <p>
            You may use these Tellann assets to accurately refer to Tellann,
            subject to these guidelines. Use does not imply endorsement,
            partnership, sponsorship, or affiliation unless explicitly agreed.
          </p>
        </div>
      </section>

      <section className="brand-contact">
        <div className="brand-shell">
          <p className="brand-kicker">Brand contact</p>
          <h2>
            Not sure whether
            <br />
            your use fits?
          </h2>
          <p>
            For press, partnership, or brand-use questions, contact the Tellann
            team.
          </p>
          <div className="brand-actions">
            <Link
              className="brand-button brand-button-solid"
              href="/contact?reason=press#contact-form"
            >
              Press enquiry <span>→</span>
            </Link>
            <Link className="brand-button" href="/contact?reason=partnership#contact-form">
              Partnership enquiry <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
