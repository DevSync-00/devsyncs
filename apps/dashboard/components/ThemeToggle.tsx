'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Determine initial theme
    const root = document.documentElement;
    const isDark = root.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const isDark = root.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';

    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
    
    // Dispatch custom event to let other components know the theme changed (e.g. logos)
    window.dispatchEvent(new Event('themechange'));
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="relative w-9 h-9 rounded-lg hover:bg-secondary border border-border/40 flex items-center justify-center transition-colors"
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <Sun className={`w-[1.2rem] h-[1.2rem] transition-all absolute ${theme === 'dark' ? 'scale-0 rotate-90' : 'scale-100 rotate-0'} text-amber-500`} />
      <Moon className={`w-[1.2rem] h-[1.2rem] transition-all absolute ${theme === 'dark' ? 'scale-100 rotate-0' : 'scale-0 -rotate-90'} text-primary`} />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
