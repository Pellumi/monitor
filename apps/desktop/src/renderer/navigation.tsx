import { BarChart3, Code2, Folder, Play, Workflow, type LucideIcon } from 'lucide-react';

export type DesktopSection = 'projects' | 'intent' | 'instrumentation' | 'qa-runs' | 'reports';

export type DesktopNavItem = {
  id: DesktopSection;
  label: string;
  icon: LucideIcon;
  projectScoped: boolean;
  resolveHref(projectId?: string): string;
  matches(pathname: string, projectId?: string): boolean;
};

const sectionHref = (section: Exclude<DesktopSection, 'projects'>, projectId?: string) =>
  projectId ? `/projects/${projectId}/${section}` : `/projects?next=${section}`;

export const desktopNavigation: DesktopNavItem[] = [
  {
    id: 'projects',
    label: 'Projects',
    icon: Folder,
    projectScoped: false,
    resolveHref: () => '/projects',
    matches: (pathname) =>
      pathname === '/projects'
      || pathname === '/projects/new'
      || /^\/projects\/[^/]+(?:\/(?:workspace|sources|environments|activity))?$/.test(pathname),
  },
  {
    id: 'intent',
    label: 'Intent',
    icon: Workflow,
    projectScoped: true,
    resolveHref: (projectId) => sectionHref('intent', projectId),
    matches: (pathname, projectId) => Boolean(projectId && pathname.startsWith(`/projects/${projectId}/intent`)),
  },
  {
    id: 'instrumentation',
    label: 'Instrumentation',
    icon: Code2,
    projectScoped: true,
    resolveHref: (projectId) => sectionHref('instrumentation', projectId),
    matches: (pathname, projectId) => Boolean(projectId && pathname.startsWith(`/projects/${projectId}/instrumentation`)),
  },
  {
    id: 'qa-runs',
    label: 'QA Runs',
    icon: Play,
    projectScoped: true,
    resolveHref: (projectId) => sectionHref('qa-runs', projectId),
    matches: (pathname, projectId) => Boolean(projectId && pathname.startsWith(`/projects/${projectId}/qa-runs`)),
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    projectScoped: true,
    resolveHref: (projectId) => sectionHref('reports', projectId),
    matches: (pathname, projectId) => Boolean(projectId && pathname.startsWith(`/projects/${projectId}/reports`)),
  },
];
