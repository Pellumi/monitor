import { CAPABILITY_REGISTRY } from './registry';
import type { CapabilityResolutionMap } from './resolver';
import type { CapabilityKey, CapabilityState, NavigationSection } from './types';

/** States that remove a navigation item from the sidebar (doc §25). */
const HIDDEN_STATES: ReadonlySet<CapabilityState> = new Set(['NOT_APPLICABLE', 'UNAVAILABLE', 'NOT_AUTHORIZED']);

export interface NavigationItem {
  key: CapabilityKey;
  name: string;
  route: string;
  state: CapabilityState;
  /** Shown but locked: an upgrade path, not an error. */
  locked: boolean;
}

export interface NavigationSectionModel {
  section: NavigationSection;
  items: NavigationItem[];
}

/**
 * Resolved sidebar. Sections and items follow registry order, so the layout is one
 * definition shared by every surface. Hidden items never appear, not even disabled.
 */
export function resolveNavigation(resolutions: CapabilityResolutionMap): NavigationSectionModel[] {
  const sections: NavigationSectionModel[] = [];
  for (const definition of CAPABILITY_REGISTRY) {
    const route = definition.navigation.route;
    if (route === null) continue;
    const resolution = resolutions[definition.key];
    if (HIDDEN_STATES.has(resolution.state)) continue;

    let section = sections.find((entry) => entry.section === definition.navigation.section);
    if (!section) {
      section = { section: definition.navigation.section, items: [] };
      sections.push(section);
    }
    section.items.push({
      key: definition.key,
      name: definition.name,
      route,
      state: resolution.state,
      locked: resolution.state === 'PLAN_LOCKED',
    });
  }
  return sections;
}
