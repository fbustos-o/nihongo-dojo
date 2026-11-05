import { useT } from '../i18n';

export function Loading({ label }: { label?: string }) {
  const t = useT();
  return (
    <p className="muted" role="status" data-testid="loading">
      {label ?? t('common.loading')}
    </p>
  );
}
