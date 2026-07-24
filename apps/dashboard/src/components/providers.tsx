'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState, useEffect, createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  preferredAuthMode: 'OTP' | 'PASSWORD';
  hasPassword: boolean;
  isSystemAdmin?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  subscription: {
    planName: string;
    planType: string;
    status: string;
  } | null;
}

export interface Membership {
  id: string;
  role: string;
  organization: Organization;
}

export interface SessionContextType {
  user: User | null;
  memberships: Membership[];
  selectedOrg: Organization | null;
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string) => void;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType>(null!);

export function useSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  const fetchSession = async () => {
    try {
      const res = await authenticatedFetch('/api-gateway/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setMemberships(data.memberships);
        
        // Restore selected org from localStorage or default to first
        const savedOrgId = localStorage.getItem('sots_selected_org_id');
        const validOrg = data.memberships.find((m: Membership) => m.organization.id === savedOrgId);
        if (validOrg) {
          setSelectedOrgIdState(savedOrgId);
        } else if (data.memberships.length > 0) {
          const defaultId = data.memberships[0].organization.id;
          setSelectedOrgIdState(defaultId);
          localStorage.setItem('sots_selected_org_id', defaultId);
        }
      } else {
        setUser(null);
        setMemberships([]);
        setSelectedOrgIdState(null);
      }
    } catch (err) {
      console.error('[SessionProvider] Fetch session failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fetch session on load, skip only on unauthenticated auth routes to prevent redirection loops
    if (!pathname?.startsWith('/auth')) {
      fetchSession();
    } else {
      setIsLoading(false);
    }
  }, [pathname]);

  const setSelectedOrgId = (id: string) => {
    setSelectedOrgIdState(id);
    localStorage.setItem('sots_selected_org_id', id);
  };

  const selectedOrg = memberships.find((m) => m.organization.id === selectedOrgId)?.organization || null;

  return (
    <SessionContext.Provider
      value={{
        user,
        memberships,
        selectedOrg,
        selectedOrgId,
        setSelectedOrgId,
        isLoading,
        refetch: fetchSession,
      }}
    >
      {isLoading ? (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-[#c4c7c8] gap-3 font-mono">
          <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-xs tracking-widest uppercase text-[#8e9192]">Initializing Tellann...</p>
        </div>
      ) : (
        children
      )}
    </SessionContext.Provider>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        {children}
      </SessionProvider>
    </QueryClientProvider>
  );
}
