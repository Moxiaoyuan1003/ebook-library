# 个人图书管理

一个基于 Electron + React + FastAPI 的桌面图书管理应用，支持多种电子书格式的阅读、AI 辅助分析和知识管理。

## 功能特性

### 图书管理
- 支持 PDF、EPUB、TXT、MOBI、DOCX 格式导入
- 图书库浏览，封面展示
- 标签和书架分类管理
- 全文搜索

### 阅读器
- 内置 PDF 阅读器（缩放、翻页、适宽）
- 内置 EPUB 阅读器（目录导航、进度记忆）
- 阅读进度自动保存

### AI 辅助
- 阅读中划词问答
- AI 自动生成图书摘要和标签
- 支持 OpenAI、Claude、Ollama 三种 AI 服务

### 知识管理
- 文本高亮标注
- 知识卡片创建和管理
- 批注侧边栏
- 导出功能（Markdown、CSV、PDF）

## 截图

> TODO: 添加应用截图

## 快速开始

### 下载安装

从 [Releases](https://github.com/Moxiaoyuan1003/ebook-library/releases) 页面下载对应平台的安装包：

- **Windows:** `.exe` 安装包或便携版
- **macOS:** `.dmg` 安装包
- **Linux:** `.AppImage` 或 `.deb`

### 开发环境

**前置要求：**
- Node.js 20+
- Python 3.11+
- PostgreSQL（开发模式）或 SQLite（桌面模式自动使用）

**1. 克隆项目**
```bash
git clone https://github.com/Moxiaoyuan1003/ebook-library.git
cd ebook-library
```

**2. 启动后端**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env  # 编辑 .env 配置数据库和 AI 密钥
uvicorn app.main:app --reload
```

**3. 启动前端**
```bash
cd frontend
npm install
npm run electron:dev
```

### 环境变量

复制 `.env.example` 为 `.env`，配置以下变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接地址 | `postgresql://...` |
| `AI_PROVIDER` | AI 服务 (`openai` / `claude` / `ollama`) | `openai` |
| `OPENAI_API_KEY` | OpenAI API 密钥 | - |
| `CLAUDE_API_KEY` | Claude API 密钥 | - |
| `OLLAMA_BASE_URL` | Ollama 服务地址 | `http://localhost:11434` |

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18, TypeScript, Ant Design, Zustand, Vite |
| 桌面 | Electron 32, electron-builder, electron-updater |
| 后端 | FastAPI, SQLAlchemy, Alembic, uvicorn |
| 数据库 | PostgreSQL（开发）/ SQLite（桌面） |
| AI | OpenAI, Claude, Ollama |
| 打包 | PyInstaller（后端）, Electron Builder（前端） |

## 项目结构

```
ebook-library/
├── frontend/                # 前端 + Electron
│   ├── src/
│   │   ├── components/      # 通用组件
│   │   ├── pages/           # 页面组件
│   │   ├── services/        # API 客户端
│   │   └── stores/          # Zustand 状态管理
│   ├── electron/            # Electron 主进程
│   └── package.json
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── api/             # API 路由
│   │   ├── core/            # 配置、数据库、工具
│   │   ├── models/          # SQLAlchemy 模型
│   │   └── services/        # 业务逻辑
│   ├── tests/               # 后端测试
│   └── requirements.txt
└── .github/workflows/       # CI/CD
```

## 构建发布

```bash
# 1. 打包后端
cd backend
pyinstaller backend.spec --clean --noconfirm

# 2. 打包前端（选择平台）
cd frontend
npm run electron:build:win     # Windows
npm run electron:build:mac     # macOS
npm run electron:build:linux   # Linux
```

或推送 `v*` 标签触发 GitHub Actions 自动构建：

```bash
git tag v1.0.1
git push origin v1.0.1
```

## 测试

```bash
# 后端测试
cd backend
python -m pytest tests/ -v

# 前端测试
cd frontend
npx vitest run

# 代码检查
cd backend && ruff check app/ tests/
cd frontend && npm run lint
```

## License

MIT
