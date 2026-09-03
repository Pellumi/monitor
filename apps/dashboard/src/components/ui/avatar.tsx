"use client";

import { useState } from "react";
import { cn } from "@/components/ui/utils";
import { avatarInitials } from "@/lib/avatar";

export interface AvatarProps {
  /** Ready-to-render image URL. Falls back to initials when absent or on load error. */
  src?: string | null;
  name?: string | null;
  email?: string | null;
  /** Pixel size of the square/circle. */
  size?: number;
  shape?: "square" | "circle";
  className?: string;
}

/**
 * User avatar with a graceful fallback: renders the image when one is given and
 * loads, otherwise a monogram tile. The `src` the app passes is already
 * resolved server-side (upload / chosen DiceBear / email default), so a fallback
 * only shows on a genuine network failure.
 */
export function Avatar({ src, name, email, size = 28, shape = "square", className }: AvatarProps) {
  // Track the specific URL that failed rather than a boolean, so a new `src`
  // gets a fresh attempt without needing an effect to reset the flag.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const radius = shape === "circle" ? "rounded-full" : "";
  const box = { width: size, height: size };

  if (src && failedSrc !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars are remote (DiceBear / object storage), not build-time assets
      <img
        src={src}
        alt={name || email || "Avatar"}
        width={size}
        height={size}
        style={box}
        onError={() => setFailedSrc(src)}
        className={cn("flex-shrink-0 border border-[#262626] bg-black object-cover", radius, className)}
      />
    );
  }

  return (
    <div
      aria-label={name || email || "Avatar"}
      role="img"
      style={box}
      className={cn(
        "flex flex-shrink-0 items-center justify-center border border-[#444748] bg-black font-mono font-bold uppercase tracking-widest text-white",
        radius,
        className,
      )}
    >
      <span style={{ fontSize: Math.max(9, Math.round(size * 0.36)) }}>
        {avatarInitials(name, email)}
      </span>
    </div>
  );
}
