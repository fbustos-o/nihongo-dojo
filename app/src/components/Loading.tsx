export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <p className="muted" role="status" data-testid="loading">
      {label}
    </p>
  );
}
