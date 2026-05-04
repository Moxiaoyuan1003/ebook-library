import { useEffect, useState } from 'react';
import { Modal, Button, Space, Typography, Progress } from 'antd';

const { Text, Paragraph } = Typography;

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

export default function UpdateModal() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    api.onUpdateAvailable((info: UpdateInfo) => {
      setUpdateInfo(info);
      setDownloaded(false);
      setDownloading(false);
    });

    api.onUpdateDownloaded(() => {
      setDownloaded(true);
      setDownloading(false);
    });

    api.onDownloadProgress((data: { percent: number }) => {
      setPercent(Math.round(data.percent));
    });
  }, []);

  const handleDownload = () => {
    setDownloading(true);
    (window as any).electronAPI?.downloadUpdate();
  };

  const handleInstall = () => {
    (window as any).electronAPI?.installUpdate();
  };

  if (!updateInfo) return null;

  return (
    <Modal
      title="发现新版本"
      open={!!updateInfo}
      onCancel={() => setUpdateInfo(null)}
      footer={null}
      closable={!downloading}
      maskClosable={!downloading}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text>新版本 v{updateInfo.version} 已发布</Text>
        {updateInfo.releaseNotes && (
          <Paragraph
            ellipsis={{ rows: 3, expandable: true }}
            style={{ maxHeight: 200, overflow: 'auto' }}
          >
            {updateInfo.releaseNotes}
          </Paragraph>
        )}
        {downloading && <Progress percent={percent} status="active" />}
        {downloaded ? (
          <Button type="primary" onClick={handleInstall} block>
            重启并安装更新
          </Button>
        ) : downloading ? (
          <Button disabled block>
            下载中... {percent}%
          </Button>
        ) : (
          <Button type="primary" onClick={handleDownload} block>
            下载更新
          </Button>
        )}
      </Space>
    </Modal>
  );
}
