interface EndpointBlockProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
}

const METHOD_COLORS = {
  GET: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  POST: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  DELETE: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  PATCH: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

export function EndpointBlock({ method, path }: EndpointBlockProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-neutral-800 bg-neutral-900/30 font-mono text-xs my-4 transition-all hover:bg-neutral-900/50">
      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${METHOD_COLORS[method] || 'bg-neutral-500/10 text-neutral-400 border-neutral-800'}`}>
        {method}
      </span>
      <span className="text-neutral-300 truncate">{path}</span>
    </div>
  );
}
