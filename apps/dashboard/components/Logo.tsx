'use client';

import { useEffect, useState } from 'react';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  variant?: 'original' | 'adaptive';
  animated?: boolean;
}

export default function Logo({
  className = '',
  width = 36,
  height = 36,
  variant = 'original',
  animated = true,
}: LogoProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Determine active theme
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    };

    checkTheme();

    // Listen to the custom themechange event
    window.addEventListener('themechange', checkTheme);
    return () => window.removeEventListener('themechange', checkTheme);
  }, []);

  const isDarkLogo = variant === 'adaptive' && theme === 'light'; 
  const logoFill = isDarkLogo ? 'black' : variant === 'adaptive' ? 'white' : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 69 68"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${animated ? 'group' : ''}`}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatEllipse {
          0%, 100% { transform: translateY(0px) scaleX(1); opacity: 0.9; }
          50% { transform: translateY(-2px) scaleX(0.95); opacity: 1; }
        }
        @keyframes syncPulseLeft {
          0%, 100% { transform: translateX(0px); opacity: 0.8; }
          50% { transform: translateX(-1.5px); opacity: 1; }
        }
        @keyframes syncPulseRight {
          0%, 100% { transform: translateX(0px); opacity: 0.8; }
          50% { transform: translateX(1.5px); opacity: 1; }
        }
        @keyframes layerGlow {
          0%, 100% { opacity: 0.85; filter: drop-shadow(0 0 0px var(--primary)); }
          50% { opacity: 1; filter: drop-shadow(0 0 3px var(--primary)); }
        }
        .logo-ellipse {
          transform-origin: 34.5px 4.5px;
          animation: floatEllipse 3s ease-in-out infinite;
        }
        .logo-left-wing {
          transform-origin: 7.5px 36.5px;
          animation: ${animated ? 'syncPulseLeft 3.5s ease-in-out infinite' : 'none'};
        }
        .logo-right-wing {
          transform-origin: 64.5px 14.5px;
          animation: ${animated ? 'syncPulseRight 4s ease-in-out infinite' : 'none'};
        }
        .logo-center-block {
          transform-origin: 37px 45px;
          animation: ${animated ? 'layerGlow 4s ease-in-out infinite' : 'none'};
        }
      `}} />

      {/* Top Ellipse - Floating Control Node */}
      <ellipse
        cx="34.5"
        cy="4.5"
        rx="24.5"
        ry="4.5"
        fill={logoFill || '#685EC3'}
        className="logo-ellipse"
      />

      {/* Top Right Curved Connector Block */}
      <path
        d="M69 14.5C69 16.5119 69 17.3143 69 19C69 22 65.5 22 63.5 22C60 22 60 20.1421 60 16C60 11.8579 60 11 62 10C63 9.5 66 10 69 7C69 8.41803 69 12.4881 69 14.5Z"
        fill={logoFill || '#332BA4'}
        className="logo-right-wing"
      />

      {/* Left Data Bridge Wing */}
      <path
        d="M15 37.5C15 41 14.1421 43 10 43C7.58255 43 2.0807 41.2963 8.28505e-06 39C-3.15905e-06 37.5 5.126e-06 35.4546 5.126e-06 33.5C5.126e-06 28.8056 0 29 0 26C6 32.5 15 27.5 15 37.5Z"
        fill={logoFill || '#4E46B7'}
        className="logo-left-wing"
      />

      {/* Main Bridge Center Cylinder Layer */}
      <path
        d="M69 33.5C69 35.9649 69 33.5 69 38.5C69 43.5 50.5 45 37 45C23.5 45 23 44.5 23 39C23 33.5 25 32.5 29.5 32.5C45.1332 32.5 61 33.5 69 26C69 28 69 30.8217 69 33.5Z"
        fill={logoFill || '#4E46B7'}
        className="logo-center-block"
      />

      {/* Bottom Main Storage Node */}
      <path
        d="M50 60C50 66.2759 44.5 68 36.5 68C25.2064 68 5.90216 66.7171 2.8789e-05 61.5C0 60 0 55.6562 0 54.5C0 52.1029 0 49.5 1.45435e-05 45C11.5 52.5 31 51 38 51C48 51 50 53.7241 50 60Z"
        fill={logoFill || '#332BA4'}
      />

      {/* Bottom Right Wing Node */}
      <path
        d="M69 54.5C69 56.5497 69 59.5 69 61.5C67.5 63 65.6874 64 63.5 64C58 64 56 61 56 56C56 51 59 48.5 60 48.5C62.3919 48.5 65 48.5 69 45C69 48 69 52.6321 69 54.5Z"
        fill={logoFill || '#6059C2'}
      />

      {/* Main Relational Curve Layer */}
      <path
        d="M54 18C54 26 51.1253 26 34 26C24.7581 26 6 25 1.45435e-05 20C-1.35899e-05 18.5 8.46386e-06 15.9949 8.46386e-06 14C8.46386e-06 12.5132 1.35899e-05 9.5 0 7C18 14.5 38.3139 11.5 49 11.5C52 11.5 54 13 54 18Z"
        fill={logoFill || '#6059C2'}
      />
    </svg>
  );
}
