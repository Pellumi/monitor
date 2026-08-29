const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const securityEmail = process.env.SECURITY_CONTACT_EMAIL || "security@domain-name.com";

export function GET() {
  const expires = new Date();
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  const body = [`Contact: mailto:${securityEmail}`, `Expires: ${expires.toISOString()}`, `Policy: ${siteUrl}/security`, "Preferred-Languages: en", `Canonical: ${siteUrl}/.well-known/security.txt`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
