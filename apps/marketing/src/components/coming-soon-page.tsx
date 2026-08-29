import Link from "next/link";

type ComingSoonPageProps = {
  eyebrow?: string;
  title: string;
  description: string;
  route: string;
  backHref?: string;
  backLabel?: string;
};

export function ComingSoonPage({
  eyebrow = "Tellann Desktop · Coming soon",
  title,
  description,
  route,
  backHref = "/desktop",
  backLabel = "Back to Tellann Desktop",
}: ComingSoonPageProps) {
  return (
    <main className="placeholder-page">
      <div className="placeholder-orb" aria-hidden="true" />
      <div className="placeholder-content">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description} This route is connected and ready for its full page content.</p>
        <div className="placeholder-actions">
          <Link href={backHref}>← {backLabel}</Link>
          <Link href="/desktop" className="primary-link">
            Explore Tellann Desktop
          </Link>
        </div>
        <code>{route}</code>
      </div>
    </main>
  );
}
