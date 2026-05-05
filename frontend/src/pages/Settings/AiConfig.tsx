import { useEffect, useState } from 'react';
import { Card, Select, Input, Button, message, Tag, Space, Divider, Alert } from 'antd';
import { ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useAiStore } from '../../stores/aiStore';
import { aiApi, AiTestResult, AiModels } from '../../services/aiApi';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude' },
  { value: 'ollama', label: 'Ollama (本地)' },
  { value: 'custom', label: '自定义 (OpenAI 兼容)' },
];

export default function AiConfig() {
  const { config, loading, fetchConfig } = useAiStore();
  const [provider, setProvider] = useState('openai');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('https://api.openai.com/v1');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [claudeKey, setClaudeKey] = useState('');
  const [claudeModel, setClaudeModel] = useState('claude-sonnet-4-20250514');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3.1');
  const [customKey, setCustomKey] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);
  const [models, setModels] = useState<AiModels | null>(null);

  useEffect(() => { fetchConfig(); aiApi.getModels().then((r) => setModels(r.data)).catch(() => {}); }, []);

  useEffect(() => {
    if (config) {
      setProvider(config.provider || 'openai');
      setOpenaiBaseUrl(config.openai_base_url || 'https://api.openai.com/v1');
      setOpenaiModel(config.openai_model || 'gpt-4o-mini');
      setClaudeModel(config.claude_model || 'claude-sonnet-4-20250514');
      setOllamaUrl(config.ollama_url || 'http://localhost:11434');
      setOllamaModel(config.ollama_model || 'llama3.1');
      setCustomBaseUrl(config.custom_base_url || '');
      setCustomModel(config.custom_model || '');
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Record<string, string> = { provider };
      if (provider === 'openai') {
        if (openaiKey) data.openai_api_key = openaiKey;
        data.openai_base_url = openaiBaseUrl;
        data.openai_model = openaiModel;
      } else if (provider === 'claude') {
        if (claudeKey) data.claude_api_key = claudeKey;
        data.claude_model = claudeModel;
      } else if (provider === 'ollama') {
        data.ollama_url = ollamaUrl;
        data.ollama_model = ollamaModel;
      } else if (provider === 'custom') {
        if (customKey) data.custom_api_key = customKey;
        data.custom_base_url = customBaseUrl;
        data.custom_model = customModel;
      }
      await aiApi.saveConfig(data);
      message.success('配置已保存');
      fetchConfig();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await aiApi.testConnection();
      setTestResult(res.data);
    } catch {
      setTestResult({ success: false, error: '请求失败', provider: null });
    } finally {
      setTesting(false);
    }
  };

  const currentModels = provider === 'custom' ? [] : (models?.[provider as keyof AiModels] || []);

  if (loading) return <Card loading />;

  return (
    <Card title={<Space><ThunderboltOutlined />AI 配置</Space>}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>AI 服务提供商</div>
        <Select
          value={provider}
          onChange={(v) => { setProvider(v); setTestResult(null); }}
          options={PROVIDERS}
          style={{ width: '100%' }}
        />
      </div>

      {provider === 'openai' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              API Key {config?.has_openai_key && <Tag color="green">已配置</Tag>}
            </div>
            <Input.Password
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder={config?.has_openai_key ? '已配置，留空保持不变' : 'sk-...'}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>Base URL</div>
            <Input
              value={openaiBaseUrl}
              onChange={(e) => setOpenaiBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>模型</div>
            <Select
              value={openaiModel}
              onChange={setOpenaiModel}
              style={{ width: '100%' }}
              options={currentModels.map((m) => ({ value: m.id, label: m.name }))}
              showSearch
              allowClear={false}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ padding: '0 8px 4px' }}>
                    <Input
                      size="small"
                      placeholder="输入自定义模型 ID"
                      value={openaiModel}
                      onChange={(e) => setOpenaiModel(e.target.value)}
                    />
                  </div>
                </>
              )}
            />
          </div>
        </>
      )}

      {provider === 'claude' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              API Key {config?.has_claude_key && <Tag color="green">已配置</Tag>}
            </div>
            <Input.Password
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
              placeholder={config?.has_claude_key ? '已配置，留空保持不变' : 'sk-ant-...'}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>模型</div>
            <Select
              value={claudeModel}
              onChange={setClaudeModel}
              style={{ width: '100%' }}
              options={currentModels.map((m) => ({ value: m.id, label: m.name }))}
              showSearch
              allowClear={false}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ padding: '0 8px 4px' }}>
                    <Input
                      size="small"
                      placeholder="输入自定义模型 ID"
                      value={claudeModel}
                      onChange={(e) => setClaudeModel(e.target.value)}
                    />
                  </div>
                </>
              )}
            />
          </div>
        </>
      )}

      {provider === 'ollama' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>Ollama 地址</div>
            <Input
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>模型</div>
            <Select
              value={ollamaModel}
              onChange={setOllamaModel}
              style={{ width: '100%' }}
              options={currentModels.map((m) => ({ value: m.id, label: m.name }))}
              showSearch
              allowClear={false}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ padding: '0 8px 4px' }}>
                    <Input
                      size="small"
                      placeholder="输入自定义模型 ID（需先 ollama pull）"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                    />
                  </div>
                </>
              )}
            />
          </div>
        </>
      )}

      {provider === 'custom' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              API Key {config?.has_custom_key && <Tag color="green">已配置</Tag>}
            </div>
            <Input.Password
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder={config?.has_custom_key ? '已配置，留空保持不变' : '输入 API Key'}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>Base URL</div>
            <Input
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="https://your-api.example.com/v1"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>模型 ID</div>
            <Input
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="输入模型 ID"
            />
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <Button type="primary" onClick={handleSave} loading={saving}>保存配置</Button>
        <Button onClick={handleTest} loading={testing}>测试连接</Button>
      </div>

      {testResult && (
        <div style={{ marginTop: 16 }}>
          {testResult.success ? (
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              message={`连接成功 (${testResult.provider})`}
              description={testResult.response}
            />
          ) : (
            <Alert
              type="error"
              showIcon
              icon={<CloseCircleOutlined />}
              message="连接失败"
              description={testResult.error}
            />
          )}
        </div>
      )}
    </Card>
  );
}
