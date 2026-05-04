import { Tabs } from 'antd';
import {
  SettingOutlined,
  ImportOutlined,
  FolderOutlined,
  BgColorsOutlined,
  SyncOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import AiConfig from './AiConfig';
import UpdateChecker from '../../components/UpdateChecker';

export default function SettingsPage() {
  const items = [
    { key: 'ai', label: 'AI 配置', icon: <SettingOutlined />, children: <AiConfig /> },
    {
      key: 'import',
      label: '导入管理',
      icon: <ImportOutlined />,
      children: <div>导入管理设置</div>,
    },
    {
      key: 'shelves',
      label: '书架管理',
      icon: <FolderOutlined />,
      children: <div>书架管理设置</div>,
    },
    { key: 'appearance', label: '外观', icon: <BgColorsOutlined />, children: <div>外观设置</div> },
    { key: 'update', label: '更新', icon: <SyncOutlined />, children: <UpdateChecker /> },
    { key: 'about', label: '关于', icon: <InfoCircleOutlined />, children: <div>关于页面</div> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>设置</h2>
      <Tabs tabPosition="left" items={items} />
    </div>
  );
}
