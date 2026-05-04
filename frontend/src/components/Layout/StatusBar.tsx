import { useEffect } from 'react';
import { Tag } from 'antd';
import { useAppStore } from '../../stores/appStore';

const providerLabels: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  ollama: 'Ollama',
  none: '不可用',
};

export default function StatusBar() {
  const importProgress = useAppStore((state) => state.importProgress);
  const aiStatus = useAppStore((state) => state.aiStatus);
  const fetchAiStatus = useAppStore((state) => state.fetchAiStatus);

  useEffect(() => {
    fetchAiStatus();
    const timer = setInterval(fetchAiStatus, 30000);
    return () => clearInterval(timer);
  }, [fetchAiStatus]);

  const provider = aiStatus?.provider ?? 'none';
  const available = aiStatus?.available ?? false;
  const online = aiStatus?.online ?? false;

  return (
    <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: '#0d0d0d', borderTop: '1px solid #303030', fontSize: 12, color: '#888' }}>
      <span>
        {importProgress ? (
          `导入中: ${importProgress.current}/${importProgress.total} - ${importProgress.file}`
        ) : (
          '就绪'
        )}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>AI: {providerLabels[provider] ?? provider}</span>
        <Tag color={available ? 'green' : 'red'} style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: 0 }}>
          {online ? '在线' : '离线'}
        </Tag>
      </span>
    </div>
  );
}
