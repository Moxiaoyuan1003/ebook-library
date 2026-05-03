import { useAppStore } from '../../stores/appStore';

export default function StatusBar() {
  const importProgress = useAppStore((state) => state.importProgress);

  return (
    <div style={{ height: 24, display: 'flex', alignItems: 'center', padding: '0 16px', background: '#0d0d0d', borderTop: '1px solid #303030', fontSize: 12, color: '#888' }}>
      {importProgress ? (
        <span>导入中: {importProgress.current}/{importProgress.total} - {importProgress.file}</span>
      ) : (
        <span>就绪</span>
      )}
    </div>
  );
}
