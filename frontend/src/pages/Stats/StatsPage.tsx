import { useState, useEffect } from 'react';
import { Spin, Slider } from 'antd';
import {
  BookOutlined,
  FieldTimeOutlined,
  StarOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useThemeStore } from '../../stores/themeStore';
import { useGoalStore } from '../../stores/goalStore';
import { statsApi, Stats } from '../../services/statsApi';

const COLORS = ['#667eea', '#f5576c', '#43e97b', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function StatsPage() {
  const tokens = useThemeStore((s) => s.tokens);
  const dailyGoalMinutes = useGoalStore((s) => s.dailyGoalMinutes);
  const setDailyGoal = useGoalStore((s) => s.setDailyGoal);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi
      .getStats()
      .then((r) => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!stats) return null;

  const statCards = [
    {
      icon: <BookOutlined />,
      label: '总书籍',
      value: stats.total_books,
      color: '#667eea',
    },
    {
      icon: <CheckCircleOutlined />,
      label: '已读完',
      value: stats.finished,
      color: '#10b981',
    },
    {
      icon: <FieldTimeOutlined />,
      label: '阅读中',
      value: stats.reading,
      color: '#f59e0b',
    },
    {
      icon: <StarOutlined />,
      label: '已收藏',
      value: stats.favorites,
      color: '#ec4899',
    },
  ];

  const formatData = Object.entries(stats.formats).map(([name, value]) => ({
    name: name.toUpperCase(),
    value,
  }));

  const cardStyle: React.CSSProperties = {
    background: tokens.cardBg,
    border: tokens.cardBorder,
    borderRadius: tokens.radius,
    padding: 20,
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ color: tokens.text, marginBottom: 24 }}>阅读统计</h2>

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {statCards.map((s) => (
          <div key={s.label} style={cardStyle}>
            <div style={{ fontSize: 24, color: s.color, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: tokens.text }}>{s.value}</div>
            <div style={{ fontSize: 13, color: tokens.textSecondary }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Format distribution */}
        <div style={cardStyle}>
          <h3 style={{ color: tokens.text, marginBottom: 16 }}>格式分布</h3>
          {formatData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={formatData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {formatData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: tokens.cardBg,
                    border: tokens.cardBorder,
                    borderRadius: 8,
                    color: tokens.text,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', color: tokens.textMuted, padding: 48 }}>
              暂无数据
            </div>
          )}
        </div>

        {/* Format bar chart */}
        <div style={cardStyle}>
          <h3 style={{ color: tokens.text, marginBottom: 16 }}>格式数量</h3>
          {formatData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={formatData}>
                <XAxis dataKey="name" stroke={tokens.textMuted} />
                <YAxis stroke={tokens.textMuted} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: tokens.cardBg,
                    border: tokens.cardBorder,
                    borderRadius: 8,
                    color: tokens.text,
                  }}
                />
                <Bar dataKey="value" fill={tokens.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', color: tokens.textMuted, padding: 48 }}>
              暂无数据
            </div>
          )}
        </div>
      </div>

      {/* Average progress */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <h3 style={{ color: tokens.text, marginBottom: 8 }}>平均阅读进度</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              flex: 1,
              height: 12,
              background: tokens.border,
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${stats.avg_progress}%`,
                height: '100%',
                background: tokens.primaryGradient
                  ? `linear-gradient(90deg, ${tokens.primaryGradient.join(', ')})`
                  : tokens.primary,
                borderRadius: 6,
                transition: 'width 0.5s',
              }}
            />
          </div>
          <span style={{ color: tokens.text, fontWeight: 600, fontSize: 18, minWidth: 60 }}>
            {stats.avg_progress}%
          </span>
        </div>
      </div>

      {/* Reading goals */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <TrophyOutlined style={{ color: '#f59e0b', fontSize: 20 }} />
          <h3 style={{ color: tokens.text, margin: 0 }}>每日阅读目标</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <Slider
              min={5}
              max={120}
              step={5}
              value={dailyGoalMinutes}
              onChange={setDailyGoal}
              marks={{
                5: '5分',
                30: '30分',
                60: '1小时',
                120: '2小时',
              }}
            />
          </div>
          <span
            style={{
              color: tokens.text,
              fontWeight: 600,
              fontSize: 18,
              minWidth: 80,
              textAlign: 'right',
            }}
          >
            {dailyGoalMinutes} 分钟
          </span>
        </div>
      </div>
    </div>
  );
}
