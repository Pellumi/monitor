import Link from "next/link";

type DesktopRouteCalloutProps = {
  eyebrow: string;
  title: string;
  description: string;
  items?: string[];
  href?: string;
  linkLabel?: string;
};

export function DesktopRouteCallout({
  eyebrow,
  title,
  description,
  items = ["Local project", "Tellann Desktop", "Review setup", "Behavioral intelligence"],
  href = "/desktop",
  linkLabel = "Explore Tellann Desktop",
}: DesktopRouteCalloutProps) {
  return (
    <section className="desktop-route-callout" aria-label={title}>
      <div className="desktop-route-callout-copy">
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        <span>{description}</span>
        <Link href={href}>{linkLabel} <b aria-hidden="true">→</b></Link>
      </div>
      <ol aria-label="Desktop workflow">
        {items.map((item, index) => (
          <li key={item}>
            <small>{String(index + 1).padStart(2, "0")}</small>
            <strong>{item}</strong>
            {index < items.length - 1 ? <i aria-hidden="true">→</i> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
