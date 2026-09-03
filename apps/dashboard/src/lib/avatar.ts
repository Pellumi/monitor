/**
 * Avatar helpers.
 *
 * Every account has a picture. With nothing uploaded or picked it is a DiceBear
 * "notionists-neutral" illustration seeded from the email — deterministic, so
 * the same person always gets the same face. The backend resolves
 * `user.avatarUrl` to a ready-to-render URL (a presigned upload, a chosen
 * DiceBear URL, or the email default), so components can trust that field; the
 * helpers here are for the profile editor's live preview and for places that
 * only hold a user id.
 */

export const DICEBEAR_STYLE = "notionists-neutral";
const DICEBEAR_BASE = `https://api.dicebear.com/10.x/${DICEBEAR_STYLE}/svg`;

/** Background swatches offered in the profile editor. `""` means transparent. */
export const AVATAR_BACKGROUND_PRESETS: { label: string; value: string }[] = [
  { label: "Transparent", value: "" },
  { label: "Slate", value: "1e293b" },
  { label: "Iron", value: "3f3f46" },
  { label: "Violet", value: "6d28d9" },
  { label: "Blue", value: "1d4ed8" },
  { label: "Teal", value: "0f766e" },
  { label: "Amber", value: "b45309" },
  { label: "Rose", value: "be123c" },
];

/** Build a DiceBear avatar URL for `seed`, optionally with a solid background. */
export function dicebearAvatarUrl(
  seed: string,
  opts: { backgroundColor?: string } = {},
): string {
  const url = new URL(DICEBEAR_BASE);
  url.searchParams.set("seed", seed.trim() || "tellann");
  if (opts.backgroundColor) url.searchParams.set("backgroundColor", opts.backgroundColor);
  return url.toString();
}

/** True for an https URL served by the DiceBear API. */
export function isDicebearUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "api.dicebear.com";
  } catch {
    return false;
  }
}

/** 1–2 character fallback shown while an image loads or if it fails. */
export function avatarInitials(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email?.split("@")[0] || "?").trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/** The gateway route that resolves any user id to their avatar image. */
export function userAvatarEndpoint(userId: string): string {
  return `/api-gateway/auth/users/${encodeURIComponent(userId)}/avatar`;
}
