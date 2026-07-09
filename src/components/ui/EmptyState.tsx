import { ReactNode } from 'react';
import Button from './AppButton';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 gap-4">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center text-3xl text-[var(--text-muted)]">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-[var(--text)] text-lg">{title}</p>
        {description && <p className="text-[var(--text-muted)] text-sm max-w-sm">{description}</p>}
      </div>
      {action && (
        <Button variant="primary" size="md" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
