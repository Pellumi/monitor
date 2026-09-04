import { BarChart3, BookOpenText, Code2, Folder, Play, Workflow, type LucideIcon } from 'lucide-react';

export type DesktopSection = 'projects' | 'sources' | 'intent' | 'instrumentation' | 'qa-runs' | 'reports';

export type DesktopNavItem = {
  id: DesktopSection;
  label: string;
  icon: LucideIcon;
  projectScoped: boolean;
  resolveHref(projectId?: string): string;
  matches(pathname: string, projectId?: string): boolean;
};

const sectionHref = (section: Exclude<DesktopSection, 'projects'>, projectId?: string) =>
  projectId ? `/applications/${projectId}/${section}` : `/applications?next=${section}`;

export const desktopNavigation: DesktopNavItem[] = [
  {
    id: 'projects',
    label: 'Applications',
    icon: Folder,
    projectScoped: false,
    resolveHref: () => '/applications',
    matches: (pathname) =>
      pathname === '/applications'
      || pathname === '/applications/new'
      || /^\/applications\/[^/]+(?:\/(?:workspace|environments|activity))?$/.test(pathname),
  },
  // {
  //   id: 'sources',
  //   label: 'Documents',
  //   icon: BookOpenText,
  //   projectScoped: true,
  //   resolveHref: (projectId) => projectId ? `/applications/${projectId}/sources` : '/applications',
  //   matches: (pathname, projectId) => Boolean(projectId && pathname.startsWith(`/applications/${projectId}/sources`)),
  // },
  {
    id: 'intent',
    label: 'Intent',
    icon: Workflow,
    projectScoped: true,
    resolveHref: (projectId) => sectionHref('intent', projectId),
    matches: (pathname, projectId) => Boolean(projectId && pathname.startsWith(`/applications/${projectId}/intent`)),
  },
  {
    id: 'instrumentation',
    label: 'Instrumentation',
    icon: Code2,
    projectScoped: true,
    resolveHref: (projectId) => sectionHref('instrumentation', projectId),
    matches: (pathname, projectId) => Boolean(projectId && pathname.startsWith(`/applications/${projectId}/instrumentation`)),
  },
  {
    id: 'qa-runs',
    label: 'QA Runs',
    icon: Play,
    projectScoped: true,
    resolveHref: (projectId) => sectionHref('qa-runs', projectId),
    matches: (pathname, projectId) => Boolean(projectId && pathname.startsWith(`/applications/${projectId}/qa-runs`)),
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    projectScoped: true,
    resolveHref: (projectId) => sectionHref('reports', projectId),
    matches: (pathname, projectId) => Boolean(projectId && pathname.startsWith(`/applications/${projectId}/reports`)),
  },
];
