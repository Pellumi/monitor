import Image from "next/image";
import Link from "next/link";
import { logoIconText, logoIconTextBlack } from "@/lib/image";
import styles from "./service-page.module.css";

const statusUrl = process.env.NEXT_PUBLIC_STATUS_URL || "https://status.tellann.co";

export type ServiceAction = {
  label: string;
  href: string;
  primary?: boolean;
  external?: boolean;
};

export function ServiceIllustration({ label, dimensions = "760 × 320" }: { label: string; dimensions?: string }) {
  const [width, height] = dimensions.replaceAll(" ", "").split("×").map(Number);
  return (
    <div className={styles.illustration} style={{ aspectRatio: `${width} / ${height}` }} role="img" aria-label={`${label}, visual placeholder, ${dimensions} pixels`}>
      <i className={styles.forward} aria-hidden="true" />
      <i className={styles.backward} aria-hidden="true" />
      <span>Visual placeholder</span>
      <b>{label}</b>
      <small>{dimensions} px</small>
    </div>
  );
}

export function ServicePageShell({ code, label, title, description, actions, retryAction, children, reference, status = false, helpfulLinks = false }: { code?: number; label: string; title: string; description: string; actions?: ServiceAction[]; retryAction?: React.ReactNode; children?: React.ReactNode; reference?: string; status?: boolean; helpfulLinks?: boolean }) {
  return (
    <main className={`${styles.servicePage} service-page`}>
      <header className={styles.header}>
        <Link href="/" aria-label="Tellann home">
          <Image className={styles.logoDark} src={logoIconText} alt="Tellann" priority />
          <Image className={styles.logoLight} src={logoIconTextBlack} alt="Tellann" priority />
        </Link>
        <a href={statusUrl}>System status <span aria-hidden="true">↗</span></a>
      </header>
      <section className={styles.content} role={status ? "status" : undefined}>
        <div className={styles.copy}>
          <p>{code ? `${code} / ` : ""}{label}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          {actions?.length || retryAction ? <div className={styles.actions}>{retryAction}{actions?.map((action) => <Link key={`${action.label}-${action.href}`} className={action.primary ? styles.primary : undefined} href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noreferrer" : undefined}>{action.label}<span aria-hidden="true">{action.external ? "↗" : "→"}</span></Link>)}</div> : null}
          {reference ? <code>Reference: {reference}</code> : null}
        </div>
        {children}
      </section>
      {helpfulLinks ? <nav className={styles.helpful} aria-label="Helpful paths">{[
        ["Product", "Understand what Tellann does.", "/product"],
        ["Documentation", "Integrate Tellann.", process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.domain-name.com"],
        ["Pricing", "Compare Tellann plans.", "/pricing"],
        ["Company", "Learn why Tellann exists.", "/company"],
      ].map(([name, copy, href]) => <Link key={name} href={href}><span>{name}</span><small>{copy}</small><i aria-hidden="true">→</i></Link>)}</nav> : null}
      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} Tellann</span>
        <nav aria-label="Service links"><a href={statusUrl}>Status</a><Link href="/security">Security</Link><Link href="/privacy">Privacy</Link><Link href="/contact">Contact</Link></nav>
      </footer>
    </main>
  );
}
