import React from 'react';

interface CyberPanelProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  variant?: 'cyan' | 'gold';
}

/**
 * 科技感八边形切角毛玻璃底板 + 细青/金渐变边框 + 四角高亮短线
 */
export const CyberPanel: React.FC<CyberPanelProps> = ({
  children,
  className = '',
  innerClassName = '',
  variant = 'cyan',
}) => {
  const accentColor = variant === 'gold' ? '#ffd24a' : '#00d4ff';
  const borderGradient =
    variant === 'gold'
      ? 'linear-gradient(135deg, rgba(255, 210, 74, 0.78) 0%, rgba(245, 158, 11, 0.25) 45%, rgba(255, 210, 74, 0.12) 72%, rgba(253, 224, 71, 0.65) 100%)'
      : 'linear-gradient(135deg, rgba(0, 212, 255, 0.68) 0%, rgba(0, 212, 255, 0.16) 42%, rgba(0, 212, 255, 0.03) 68%, rgba(0, 212, 255, 0.48) 100%)';

  return (
    <div className={`relative ${className}`}>
      {/* 外层 1px 切角渐变边框 */}
      <div
        className="w-full h-full p-[1px] clip-octa-12"
        style={{ background: borderGradient }}
      >
        {/* 内层半透明毛玻璃底板 */}
        <div
          className={`w-full h-full clip-octa-12 flex flex-col overflow-hidden ${innerClassName}`}
          style={{
            backgroundColor:
              variant === 'gold' ? '#0e1422' : 'rgba(10, 14, 23, 0.75)',
            backdropFilter: variant === 'gold' ? undefined : 'blur(8px)',
            WebkitBackdropFilter: variant === 'gold' ? undefined : 'blur(8px)',
          }}
        >
          {children}
        </div>
      </div>

      {/* 四角切角高亮短线 */}
      <svg
        className="pointer-events-none absolute top-0 left-0 w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1 21V12.2L12.2 1H21"
          stroke={accentColor}
          strokeWidth="1.75"
          strokeLinecap="square"
        />
      </svg>
      <svg
        className="pointer-events-none absolute top-0 right-0 w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 1H11.8L23 12.2V21"
          stroke={accentColor}
          strokeWidth="1.75"
          strokeLinecap="square"
        />
      </svg>
      <svg
        className="pointer-events-none absolute bottom-0 left-0 w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1 3V11.8L12.2 23H21"
          stroke={accentColor}
          strokeWidth="1.75"
          strokeLinecap="square"
        />
      </svg>
      <svg
        className="pointer-events-none absolute bottom-0 right-0 w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 23H11.8L23 11.8V3"
          stroke={accentColor}
          strokeWidth="1.75"
          strokeLinecap="square"
        />
      </svg>
    </div>
  );
};
