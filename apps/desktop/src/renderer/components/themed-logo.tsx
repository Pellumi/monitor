import logoForDarkSurface from '../logo_icon.svg';
import logoForLightSurface from '../logo_icon_light.svg';

/**
 * The Tellann mark in the variant for the current Windows theme: white strokes
 * on dark surfaces, black strokes on light ones. Switches live with the theme.
 */
export function ThemedLogo({ className }: { className?: string }) {
  return (
    <picture className="themed-logo">
      <source srcSet={logoForLightSurface} media="(prefers-color-scheme: light)" />
      <img className={className} src={logoForDarkSurface} alt="" draggable={false} />
    </picture>
  );
}
