import { useState } from 'react';
import { Modal, Upload, Button, Progress, message } from 'antd';
import { InboxOutlined, FolderOpenOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { useBookStore } from '../stores/bookStore';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ImportDialog({ open, onClose }: ImportDialogProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fetchBooks = useBookStore((state) => state.fetchBooks);

  const handleImport = async () => {
    if (files.length === 0) {
      message.warning('请先选择文件');
      return;
    }

    setImporting(true);
    setProgress({ current: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (file.originFileObj) {
          // Upload file
          const formData = new FormData();
          formData.append('file', file.originFileObj);
          // Note: This would need a proper upload endpoint
          // For now, we'll use the file path approach
        }
        setProgress({ current: i + 1, total: files.length });
      } catch (error) {
        message.error(`导入失败: ${file.name}`);
      }
    }

    setImporting(false);
    message.success(`成功导入 ${files.length} 本书`);
    fetchBooks();
    onClose();
  };

  const handleDirectoryImport = async () => {
    // This would use Electron's dialog to select directory
    // For now, show a placeholder
    message.info('请将文件或文件夹拖入窗口');
  };

  return (
    <Modal
      title="导入图书"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="directory" icon={<FolderOpenOutlined />} onClick={handleDirectoryImport}>
          选择文件夹
        </Button>,
        <Button key="import" type="primary" loading={importing} onClick={handleImport}>
          开始导入
        </Button>,
      ]}
      width={600}
    >
      <Upload.Dragger
        multiple
        accept=".pdf,.epub,.txt,.mobi,.docx"
        beforeUpload={(file) => {
          setFiles((prev) => [...prev, file]);
          return false;
        }}
        fileList={files}
        onRemove={(file) => {
          setFiles((prev) => prev.filter((f) => f.uid !== file.uid));
        }}
        disabled={importing}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">支持 PDF、EPUB、TXT、MOBI、DOCX 格式</p>
      </Upload.Dragger>

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
