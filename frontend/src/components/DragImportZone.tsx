import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useThemeStore } from '../stores/themeStore';
import { bookApi } from '../services/bookApi';

interface DragImportZoneProps {
  onImportComplete?: () => void;
  children: React.ReactNode;
}

export default function DragImportZone({ onImportComplete, children }: DragImportZoneProps) {
  const tokens = useThemeStore((s) => s.tokens);
  const [dragging, setDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    let successCount = 0;
    for (const file of files) {
      try {
        await bookApi.importFile((file as any).path);
        successCount++;
      } catch {
        // skip failed files
      }
    }

    if (successCount > 0) {
      message.success(`成功导入 ${successCount} 本书籍`);
      onImportComplete?.();
    }
  }, [onImportComplete]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative', height: '100%' }}
    >
      {children}
      {dragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            background: 'rgba(59,130,246,0.15)',
            backdropFilter: 'blur(4px)',
            border: `2px dashed ${tokens.primary}`,
            borderRadius: tokens.radius,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 600,
            color: tokens.primary,
          }}
        >
          释放文件以导入
        </div>
      )}
    </div>
  );
}
