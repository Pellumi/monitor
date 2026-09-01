'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface SidebarModeContextType {
  /** When true the sidebar renders in a narrow icon-only mode. */
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}

const SidebarModeContext = createContext<SidebarModeContextType>({
  collapsed: false,
  setCollapsed: () => {},
});

/**
 * Lets a focused page (for example the flow create canvas) shrink the sidebar to
 * icon mode so the main area gets more room, then restore it on the way out.
 */
export function SidebarModeProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SidebarModeContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarModeContext.Provider>
  );
}

export function useSidebarMode() {
  return useContext(SidebarModeContext);
}
