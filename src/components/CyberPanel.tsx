import React from 'react';

interface CyberPanelProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  variant?: 'cyan' | 'gold';
  wireframeMode?: boolean;
}

/**
 * 双模态容器面板：
 * - 0.2版 (wireframeMode = false)：科技感八边形切角毛玻璃底板 + 细青/金渐变边框 + 四角高亮短线
 * - 0.1版 (wireframeMode = true)：全息 HUD 抬头显示风格，纯透明背景 rgba(0,0,0,0) + 四角极细青色 L 型直角折线 + 顶部/底部仪表刻度尺线
 */
export const CyberPanel: React.FC<CyberPanelProps> = ({
  children,
  className = '',
  innerClassName = '',
  variant = 'cyan',
  wireframeMode = false,
}) => {
  const accentColor = wireframeMode
    ? '#00d4ff'
    : variant === 'gold'
    ? '#ffd24a'
    : '#00d4ff';

  const borderGradient =
    variant === 'gold'
      ? 'linear-gradient(135deg, rgba(255, 210, 74, 0.78) 0%, rgba(245, 158, 11, 0.25) 45%, rgba(255, 210, 74, 0.12) 72%, rgba(253, 224, 71, 0.65) 100%)'
      : 'linear-gradient(135deg, rgba(0, 212, 255, 0.68) 0%, rgba(0, 212, 255, 0.16) 42%, rgba(0, 212, 255, 0.03) 68%, rgba(0, 212, 255, 0.48) 100%)';

  return (
    <div className={`relative transition-all duration-700 ease-out ${className}`}>
      {/* 外层边框容器 */}
      <div
        className={`w-full h-full transition-all duration-700 ease-out ${
          wireframeMode
            ? 'p-0 border border-[#00d4ff]/25'
            : 'p-[1px] clip-octa-12'
        }`}
        style={{
          background: wireframeMode ? 'rgba(0, 0, 0, 0)' : borderGradient,
        }}
      >
        {/* 内层面板主体 */}
        <div
          className={`w-full h-full flex flex-col overflow-hidden transition-all duration-700 ease-out ${
            wireframeMode ? '' : 'clip-octa-12'
          } ${innerClassName}`}
          style={{
            backgroundColor: wireframeMode
              ? 'rgba(0, 0, 0, 0)'
              : variant === 'gold'
              ? '#0e1422'
              : 'rgba(10, 14, 23, 0.75)',
            backdropFilter:
              wireframeMode || variant === 'gold' ? undefined : 'blur(8px)',
            WebkitBackdropFilter:
              wireframeMode || variant === 'gold' ? undefined : 'blur(8px)',
          }}
        >
          {children}
        </div>
      </div>

      {wireframeMode ? (
        <>
          {/* 0.1版专属：四角极细青色 L 型直角折线 (1px crisp L-brackets) */}
          <span
            className="pointer-events-none absolute -top-[1px] -left-[1px] w-3.5 h-3.5 border-t border-l border-[#00d4ff]"
            style={{ boxShadow: '-1px -1px 6px rgba(0, 212, 255, 0.35)' }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -top-[1px] -right-[1px] w-3.5 h-3.5 border-t border-r border-[#00d4ff]"
            style={{ boxShadow: '1px -1px 6px rgba(0, 212, 255, 0.35)' }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -bottom-[1px] -left-[1px] w-3.5 h-3.5 border-b border-l border-[#00d4ff]"
            style={{ boxShadow: '-1px 1px 6px rgba(0, 212, 255, 0.35)' }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -bottom-[1px] -right-[1px] w-3.5 h-3.5 border-b border-r border-[#00d4ff]"
            style={{ boxShadow: '1px 1px 6px rgba(0, 212, 255, 0.35)' }}
            aria-hidden="true"
          />

          {/* 0.1版专属：顶部与底部微小刻度尺装饰线 (Instrument Ruler Ticks) */}
          <svg
            className="pointer-events-none absolute top-0 left-6 right-6 h-[5px] w-[calc(100%-3rem)]"
            viewBox="0 0 240 5"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <line x1="0" y1="0.5" x2="240" y2="0.5" stroke="#00d4ff" strokeOpacity="0.35" strokeWidth="1" />
            {[12, 28, 44, 60, 76, 92, 108, 120, 132, 148, 164, 180, 196, 212, 228].map(
              (x, idx) => (
                <line
                  key={x}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2={idx % 3 === 0 ? '4.5' : '2.5'}
                  stroke="#00d4ff"
                  strokeOpacity={idx % 3 === 0 ? '0.8' : '0.42'}
                  strokeWidth="1"
                />
              )
            )}
          </svg>

          <svg
            className="pointer-events-none absolute bottom-0 left-6 right-6 h-[5px] w-[calc(100%-3rem)]"
            viewBox="0 0 240 5"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <line x1="0" y1="4.5" x2="240" y2="4.5" stroke="#00d4ff" strokeOpacity="0.35" strokeWidth="1" />
            {[16, 36, 56, 76, 96, 120, 144, 164, 184, 204, 224].map(
              (x, idx) => (
                <line
                  key={x}
                  x1={x}
                  y1={idx % 2 === 0 ? '0.5' : '2.2'}
                  x2={x}
                  y2="5"
                  stroke="#00d4ff"
                  strokeOpacity={idx % 2 === 0 ? '0.75' : '0.38'}
                  strokeWidth="1"
                />
              )
            )}
          </svg>
        </>
      ) : (
        <>
          {/* 0.2版专属：四角八边形切角高亮短线 */}
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
        </>
      )}
    </div>
  );
};
