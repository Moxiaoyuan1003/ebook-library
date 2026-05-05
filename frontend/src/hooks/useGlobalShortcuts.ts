import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useGlobalShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

      if (e.key === '/') {
        e.preventDefault();
        navigate('/search');
      } else if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        navigate('/settings');
      } else if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        navigate('/stats');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}
