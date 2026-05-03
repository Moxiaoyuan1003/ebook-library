import { useEffect } from 'react';
import { Card, Form, Select, Input, Button } from 'antd';
import { useAiStore } from '../../stores/aiStore';

export default function AiConfig() {
  const { config, loading, fetchConfig } = useAiStore();

  useEffect(() => {
    fetchConfig();
  }, []);

  if (loading) return <Card loading />;

  return (
    <Card title="AI 配置">
      <Form layout="vertical">
        <Form.Item label="AI 服务提供商">
          <Select value={config?.provider || 'openai'} options={[
            { value: 'openai', label: 'OpenAI' },
            { value: 'claude', label: 'Claude' },
            { value: 'ollama', label: 'Ollama (本地)' },
          ]} />
        </Form.Item>
        <Form.Item label="OpenAI API Key">
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item label="Claude API Key">
          <Input.Password placeholder="sk-ant-..." />
        </Form.Item>
        <Form.Item label="Ollama 地址">
          <Input placeholder="http://localhost:11434" />
        </Form.Item>
        <Form.Item>
          <Button type="primary">保存配置</Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
