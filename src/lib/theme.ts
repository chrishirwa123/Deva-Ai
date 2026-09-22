import { useEffect } from 'react';
import { useApp } from './store';

const accentColors: Record<string, { primary: string; secondary: string; glow: string }> = {
  violet: { primary: '#8b5cf6', secondary: '#6366f1', glow: 'rgba(139, 92, 246, 0.4)' },
  blue: { primary: '#3b82f6', secondary: '#06b6d4', glow: 'rgba(59, 130, 246, 0.4)' },
  cyan: { primary: '#06b6d4', secondary: '#0891b2', glow: 'rgba(6, 182, 212, 0.4)' },
  emerald: { primary: '#10b981', secondary: '#059669', glow: 'rgba(16, 185, 129, 0.4)' },
  amber: { primary: '#f59e0b', secondary: '#d97706', glow: 'rgba(245, 158, 11, 0.4)' },
  rose: { primary: '#f43f5e', secondary: '#e11d48', glow: 'rgba(244, 63, 94, 0.4)' },
};

export function useTheme() {
  const { settings } = useApp();

  useEffect(() => {
    const accent = settings?.accent_color ?? 'violet';
    const intensity = settings?.animation_intensity ?? 'normal';
    const colors = accentColors[accent] ?? accentColors.violet;

    const root = document.documentElement;
    root.style.setProperty('--accent-primary', colors.primary);
    root.style.setProperty('--accent-secondary', colors.secondary);
    root.style.setProperty('--accent-glow', colors.glow);

    if (intensity === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.style.setProperty('--animation-duration', '0ms');
      document.body.classList.add('reduced-motion');
    } else {
      root.style.setProperty('--animation-duration', '300ms');
      document.body.classList.remove('reduced-motion');
    }
  }, [settings?.accent_color, settings?.animation_intensity]);
}

export { accentColors };
