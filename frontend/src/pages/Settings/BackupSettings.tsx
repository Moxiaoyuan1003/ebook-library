import { Button, message, Upload } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import API_BASE from '../../services/apiConfig';
import { useThemeStore } from '../../stores/themeStore';

export default function BackupSettings() {
  const tokens = useThemeStore((s) => s.tokens);

  return (
    <div>
      <p style={{ color: tokens.textSecondary, marginBottom: 16 }}>
        导出或导入您的全部书库数据（数据库、封面、配置）。
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => window.open(`${API_BASE}/api/backup/export`)}
        >
          导出备份
        </Button>
        <Upload
          action={`${API_BASE}/api/backup/import`}
          showUploadList={false}
          accept=".zip"
          onChange={(info) => {
            if (info.file.status === 'done') {
              message.success('备份已恢复，请重启应用');
            } else if (info.file.status === 'error') {
              message.error('恢复失败');
            }
          }}
        >
          <Button icon={<UploadOutlined />}>导入备份</Button>
        </Upload>
      </div>
    </div>
  );
}
