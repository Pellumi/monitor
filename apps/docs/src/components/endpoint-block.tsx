interface EndpointBlockProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
}

export function EndpointBlock({ method, path }: EndpointBlockProps) {
  return (
    <div className="docs-endpoint">
      <span data-method={method}>
        {method}
      </span>
      <code>{path}</code>
    </div>
  );
}
