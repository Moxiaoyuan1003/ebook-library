import { useThemeStore } from '../stores/themeStore';

export default function SkeletonCard() {
  const tokens = useThemeStore((s) => s.tokens);

  const shimmer = {
    background: `linear-gradient(90deg, ${tokens.cardBg} 25%, rgba(255,255,255,0.06) 50%, ${tokens.cardBg} 75%)`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 8,
  };

  return (
    <div
      style={{
        background: tokens.cardBg,
        border: tokens.cardBorder,
        borderRadius: tokens.radius,
        padding: 16,
      }}
    >
      <div style={{ ...shimmer, width: 60, height: 80, marginBottom: 12 }} />
      <div style={{ ...shimmer, width: '80%', height: 14, marginBottom: 8 }} />
      <div style={{ ...shimmer, width: '50%', height: 12, marginBottom: 12 }} />
      <div style={{ ...shimmer, width: '100%', height: 4 }} />
    </div>
  );
}
