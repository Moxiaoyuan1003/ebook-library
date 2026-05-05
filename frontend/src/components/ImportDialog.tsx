import { useState } from 'react';
import { Modal, Button, Progress, message, List, Typography } from 'antd';
import { FolderOpenOutlined, FileOutlined, DeleteOutlined } from '@ant-design/icons';
import { useBookStore } from '../stores/bookStore';
import { bookApi } from '../services/bookApi';

const { Text } = Typography;

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ImportDialog({ open, onClose }: ImportDialogProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fetchBooks = useBookStore((state) => state.fetchBooks);

  const handleSelectFiles = async () => {
    const filePath = await (window as any).electronAPI.openFile();
    if (filePath) {
      setFiles((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
    }
  };

  const handleSelectDirectory = async () => {
    const result = await (window as any).electronAPI.selectDirectory();
    if (result) {
      try {
        setImporting(true);
        const res = await bookApi.importDirectory(result);
        const count = (res.data as any)?.imported ?? 0;
        message.success(`从文件夹导入了 ${count} 本书`);
        fetchBooks();
        onClose();
      } catch {
        message.error('文件夹导入失败');
      } finally {
        setImporting(false);
      }
    }
  };

  const handleImport = async () => {
    if (files.length === 0) {
      message.warning('请先选择文件');
      return;
    }

    setImporting(true);
    setProgress({ current: 0, total: files.length });
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      try {
        await bookApi.importFile(files[i]);
        successCount++;
      } catch (err: any) {
        const raw = err?.response?.data?.detail ?? err?.response?.data ?? err.message;
        const detail = typeof raw === 'string' ? raw : JSON.stringify(raw);
        message.error(`导入失败: ${files[i].split(/[/\\]/).pop()} - ${detail}`);
      }
      setProgress({ current: i + 1, total: files.length });
    }

    setImporting(false);
    if (successCount > 0) {
      message.success(`成功导入 ${successCount} 本书`);
      fetchBooks();
    }
    setFiles([]);
    onClose();
  };

  return (
    <Modal
      title="导入图书"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={importing}>
          取消
        </Button>,
        <Button key="directory" icon={<FolderOpenOutlined />} onClick={handleSelectDirectory} loading={importing}>
          选择文件夹
        </Button>,
        <Button key="import" type="primary" loading={importing} onClick={handleImport}>
          开始导入
        </Button>,
      ]}
      width={600}
    >
      <div style={{ marginBottom: 16 }}>
        <Button icon={<FileOutlined />} onClick={handleSelectFiles} disabled={importing}>
          选择文件
        </Button>
        <Text type="secondary" style={{ marginLeft: 12 }}>
          支持 PDF、EPUB、TXT、MOBI 格式
        </Text>
      </div>

      {files.length > 0 && (
        <List
          size="small"
          bordered
          dataSource={files}
          style={{ maxHeight: 200, overflow: 'auto', marginBottom: 16 }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="remove"
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => setFiles((prev) => prev.filter((f) => f !== item))}
                  disabled={importing}
                />,
              ]}
            >
              <Text ellipsis style={{ maxWidth: 450 }}>
                {item.split(/[/\\]/).pop()}
              </Text>
            </List.Item>
          )}
        />
      )}

      {importing && (
        <div style={{ marginTop: 16 }}>
          <Progress percent={Math.round((progress.current / progress.total) * 100)} />
          <div style={{ textAlign: 'center', marginTop: 8, color: '#888' }}>
            {progress.current} / {progress.total}
          </div>
        </div>
      )}
    </Modal>
  );
}
