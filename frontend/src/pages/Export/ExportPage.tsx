import { useState } from 'react';
import {
  Card, Radio, Button, DatePicker, Input, Space, message, Spin, Divider, Typography,
} from 'antd';
import { DownloadOutlined, ExportOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { exportApi, ExportRequest } from '../../services/exportApi';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const dataTypeOptions = [
  { value: 'cards', label: '知识卡片' },
  { value: 'annotations', label: '批注笔记' },
  { value: 'books', label: '书籍列表' },
];

const formatOptions = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' },
];

const formatMimeMap: Record<string, string> = {
  markdown: 'text/markdown',
  pdf: 'application/pdf',
  csv: 'text/csv',
};

const formatExtMap: Record<string, string> = {
  markdown: 'md',
  pdf: 'pdf',
  csv: 'csv',
};

export default function ExportPage() {
  const [dataType, setDataType] = useState<ExportRequest['data_type']>('cards');
  const [format, setFormat] = useState<ExportRequest['format']>('markdown');
  const [bookId, setBookId] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    const request: ExportRequest = {
      data_type: dataType,
      format,
    };

    if (bookId || (dateRange[0] && dateRange[1])) {
      request.filters = {};
      if (bookId) {
        request.filters.book_id = bookId;
      }
      if (dateRange[0] && dateRange[1]) {
        request.filters.date_from = dateRange[0].format('YYYY-MM-DD');
        request.filters.date_to = dateRange[1].format('YYYY-MM-DD');
      }
    }

    setLoading(true);
    try {
      const response = await exportApi.export(request);
      const blob = new Blob([response.data], { type: formatMimeMap[format] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ext = formatExtMap[format];
      link.download = `export_${dataType}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch {
      message.error('导出失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <h2 style={{ color: '#fff', marginBottom: 24 }}>数据导出</h2>

      <Spin spinning={loading} tip="正在导出...">
        <Card style={{ background: '#1a1a2e', borderColor: '#303030' }}>
          <div style={{ marginBottom: 24 }}>
            <Text style={{ color: '#ccc', display: 'block', marginBottom: 8 }}>数据类型</Text>
            <Radio.Group
              value={dataType}
              onChange={(e) => setDataType(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              {dataTypeOptions.map((opt) => (
                <Radio.Button key={opt.value} value={opt.value}>
                  {opt.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>

          <div style={{ marginBottom: 24 }}>
            <Text style={{ color: '#ccc', display: 'block', marginBottom: 8 }}>导出格式</Text>
            <Radio.Group
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              {formatOptions.map((opt) => (
                <Radio.Button key={opt.value} value={opt.value}>
                  {opt.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>

          <Divider style={{ borderColor: '#303030' }}>
            <Text style={{ color: '#888', fontSize: 12 }}>可选筛选条件</Text>
          </Divider>

          <div style={{ marginBottom: 16 }}>
            <Text style={{ color: '#ccc', display: 'block', marginBottom: 8 }}>书籍 ID</Text>
            <Input
              placeholder="输入书籍 ID 进行筛选（可选）"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              allowClear
              style={{ maxWidth: 400 }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <Text style={{ color: '#ccc', display: 'block', marginBottom: 8 }}>日期范围</Text>
            <RangePicker
              value={dateRange as [dayjs.Dayjs, dayjs.Dayjs]}
              onChange={(dates) => {
                if (dates) {
                  setDateRange([dates[0], dates[1]]);
                } else {
                  setDateRange([null, null]);
                }
              }}
              style={{ maxWidth: 400 }}
            />
          </div>

          <Space>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              size="large"
              onClick={handleExport}
              loading={loading}
            >
              导出
            </Button>
            <Button
              icon={<ExportOutlined />}
              size="large"
              onClick={() => {
                setDataType('cards');
                setFormat('markdown');
                setBookId('');
                setDateRange([null, null]);
              }}
            >
              重置
            </Button>
          </Space>
        </Card>
      </Spin>
    </div>
  );
}
