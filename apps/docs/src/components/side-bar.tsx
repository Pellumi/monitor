'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { docs, CATEGORY_ORDER } from '@/lib/docs';

export function Sidebar() {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>(CATEGORY_ORDER);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  // Group pages by category
  const grouped = docs.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, typeof docs>);

  // Filter based on search query
  const filteredCategories = CATEGORY_ORDER.map((category) => {
    const items = grouped[category] || [];
    const filteredItems = items.filter(
      (item) =>
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase())
    );
    return { category, items: filteredItems };
  }).filter((group) => group.items.length > 0);

  const isActive = (slug: string) => {
    const normalizedPath = pathname.replace(/^\//, '');
    return normalizedPath === slug;
  };

  return (
    <aside className="w-72 border-r border-border bg-muted flex flex-col h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto z-10 transition-colors duration-200">
      {/* Search Input */}
      <div className="p-4 border-b border-border flex-shrink-0 bg-muted">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter documentation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-4 overflow-y-auto space-y-5 bg-muted">
        {filteredCategories.map(({ category, items }) => (
          <div key={category} className="space-y-1">
            <button
              onClick={() => toggleSection(category)}
              className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
            >
              <span>{category}</span>
              {expandedSections.includes(category) ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
            {expandedSections.includes(category) && (
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item.slug);
                  return (
                    <Link
                      key={item.slug}
                      href={`/${item.slug}`}
                      className={`group flex items-center px-3 py-1.5 text-xs rounded transition-all ${
                        active
                          ? 'bg-accent text-foreground font-semibold border-l-2 border-blue-400 rounded-l-none -ml-px'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      <span className="truncate">{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Version Tag */}
      <div className="p-4 border-t border-border bg-background/20 flex-shrink-0">
        {/* <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-background border border-border text-[10px] text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-medium">v1.0.0 (Latest Release)</span>
        </div> */}
      </div>
    </aside>
  );
}
