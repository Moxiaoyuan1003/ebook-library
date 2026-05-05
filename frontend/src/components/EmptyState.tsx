import { Button } from 'antd';
import { useThemeStore } from '../stores/themeStore';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const tokens = useThemeStore((s) => s.tokens);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 64,
        color: tokens.textSecondary,
      }}
    >
      {icon && <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>{icon}</div>}
      <div style={{ fontSize: 16, fontWeight: 600, color: tokens.text, marginBottom: 8 }}>{title}</div>
      {description && <div style={{ fontSize: 13, marginBottom: 24, textAlign: 'center' }}>{description}</div>}
      {action && (
        <Button type="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
