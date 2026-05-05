// frontend/src/components/TextSelectionMenu.tsx
import { useState } from 'react';
import { useThemeStore } from '../stores/themeStore';

interface TextSelectionMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  selectedText: string;
  onAskAI: () => void;
  onHighlight: (color: string) => void;
  onCopy: () => void;
  onAddNote: () => void;
  onAddCard: () => void;
  onClose: () => void;
}

const HIGHLIGHT_COLORS = [
  { color: '#ffeb3b', label: '黄色' },
  { color: '#69f0ae', label: '绿色' },
  { color: '#40c4ff', label: '蓝色' },
  { color: '#ff80ab', label: '粉色' },
  { color: '#b388ff', label: '紫色' },
];

export default function TextSelectionMenu({
  visible,
  position,
  selectedText,
  onAskAI,
  onHighlight,
  onCopy,
  onAddNote,
  onAddCard,
  onClose,
}: TextSelectionMenuProps) {
  const tokens = useThemeStore((s) => s.tokens);
  const [showColorPicker, setShowColorPicker] = useState(false);

  if (!visible || !selectedText) return null;

  const btnStyle = {
    background: 'transparent',
    border: 'none',
    color: tokens.text,
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 13,
    whiteSpace: 'nowrap' as const,
  };

  return (
    <>
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -100%)',
          zIndex: 1000,
          background: tokens.cardBg,
          border: tokens.cardBorder,
          borderRadius: tokens.radius,
          boxShadow: tokens.cardShadow || '0 4px 16px rgba(0,0,0,0.4)',
          padding: '6px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          animation: 'menuAppear 0.15s ease-out',
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onAskAI(); }}
          style={btnStyle}
          onMouseEnter={(e) => (e.currentTarget.style.background = tokens.sidebar)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          问 AI
        </button>
        <span style={{ width: 1, height: 18, background: tokens.border }} />
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
            style={btnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = tokens.sidebar)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            高亮
          </button>
          {showColorPicker && (
            <div
              style={{
                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                marginTop: 4, background: tokens.cardBg, border: tokens.cardBorder, borderRadius: tokens.radius, padding: '6px 8px',
                display: 'flex', gap: 6, boxShadow: tokens.cardShadow || '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {HIGHLIGHT_COLORS.map((item) => (
                <div
                  key={item.color}
                  onClick={(e) => { e.stopPropagation(); onHighlight(item.color); setShowColorPicker(false); }}
                  title={item.label}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', background: item.color,
                    cursor: 'pointer', border: '2px solid transparent', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                />
              ))}
            </div>
          )}
        </div>
        <span style={{ width: 1, height: 18, background: tokens.border }} />
        <button
          onClick={(e) => { e.stopPropagation(); onAddNote(); }}
          style={btnStyle}
          onMouseEnter={(e) => (e.currentTarget.style.background = tokens.sidebar)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          批注
        </button>
        <span style={{ width: 1, height: 18, background: tokens.border }} />
        <button
          onClick={(e) => { e.stopPropagation(); onAddCard(); }}
          style={btnStyle}
          onMouseEnter={(e) => (e.currentTarget.style.background = tokens.sidebar)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          记卡片
        </button>
        <span style={{ width: 1, height: 18, background: tokens.border }} />
        <button
          onClick={(e) => { e.stopPropagation(); onCopy(); }}
          style={btnStyle}
          onMouseEnter={(e) => (e.currentTarget.style.background = tokens.sidebar)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          复制
        </button>
      </div>
    </>
  );
}
