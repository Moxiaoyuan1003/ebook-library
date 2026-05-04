import { useState } from 'react';
import { Button, Card, Spin, Typography, Space, Tag, Alert } from 'antd';
import { SyncOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph, Link } = Typography;

const CURRENT_VERSION = '0.1.0';

interface UpdateInfo {
  has_update: boolean;
  latest_version?: string;
  release_notes?: string;
  download_url?: string;
}

export default function UpdateChecker() {
  const [loading, setLoading] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkUpdate = async () => {
    setLoading(true);
    setError(null);
    setUpdateInfo(null);
    try {
      const response = await axios.get<UpdateInfo>('/api/system/update-check');
      setUpdateInfo(response.data);
    } catch {
      setError('检查更新失败，请检查网络连接后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <Title level={4} style={{ color: '#fff', marginBottom: 24 }}>软件更新</Title>

      <Card style={{ background: '#1a1a2e', borderColor: '#303030', marginBottom: 24 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text style={{ color: '#ccc' }}>当前版本：</Text>
            <Tag color="blue" style={{ marginLeft: 8 }}>{CURRENT_VERSION}</Tag>
          </div>

          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={checkUpdate}
            loading={loading}
          >
            检查更新
          </Button>
        </Space>
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin tip="正在检查更新..." />
        </div>
      )}

      {error && (
        <Alert
          message="检查更新失败"
          description={error}
          type="error"
          icon={<ExclamationCircleOutlined />}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {updateInfo && !updateInfo.has_update && (
        <Alert
          message="已是最新版本"
          description={`当前版本 ${CURRENT_VERSION} 已是最新，无需更新。`}
          type="success"
          icon={<CheckCircleOutlined />}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {updateInfo && updateInfo.has_update && (
        <Card
          title={
            <Space>
              <span>发现新版本</span>
              <Tag color="green">{updateInfo.latest_version}</Tag>
            </Space>
          }
          style={{ background: '#1a1a2e', borderColor: '#52c41a' }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text style={{ color: '#ccc' }}>当前版本：</Text>
              <Tag>{CURRENT_VERSION}</Tag>
              <Text style={{ color: '#ccc', marginLeft: 16 }}>最新版本：</Text>
              <Tag color="green">{updateInfo.latest_version}</Tag>
            </div>

            {updateInfo.release_notes && (
              <div>
                <Text style={{ color: '#ccc', display: 'block', marginBottom: 8 }}>
                  更新内容：
                </Text>
                <Paragraph
                  style={{
                    color: '#aaa',
                    background: '#111',
                    padding: 16,
                    borderRadius: 6,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {updateInfo.release_notes}
                </Paragraph>
              </div>
            )}

            {updateInfo.download_url && (
              <Button type="primary" size="large">
                <Link
                  href={updateInfo.download_url}
                  target="_blank"
                  style={{ color: '#fff', textDecoration: 'none' }}
                >
                  前往下载
                </Link>
              </Button>
            )}
          </Space>
        </Card>
      )}
    </div>
  );
}
