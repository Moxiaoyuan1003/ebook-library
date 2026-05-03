# Personal Library Manager — 设计文档

> 文档状态：已确认 | 编写日期：2026-05-03 | 版本：v1.0

---

## 一、项目概述

**项目名称**：Personal Library Manager（个人图书管理器）

**核心目标**：在本地电脑上构建一个可管理上万本电子书的图书库系统，通过内置 AI 能力实现图书自动分析与内容检索，让"藏书"真正变为可查询、可对话的知识资产。

**技术栈**：
- 前端：Electron + React + TypeScript + Ant Design
- 后端：FastAPI + Python
- 数据库：嵌入式 PostgreSQL + pgvector
- AI 服务：OpenAI API / Anthropic Claude API / 本地 Ollama（双轨制）

**架构方案**：模块化单体架构

---

## 二、系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────┐
│                   Electron Shell                     │
│  ┌───────────────────────────────────────────────┐  │
│  │           React + Ant Design 前端              │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐│  │
│  │  │ 书库 │ │ 阅读 │ │ AI   │ │ 搜索 │ │设置 ││  │
│  │  │ 视图 │ │ 器   │ │ 助手 │ │ 界面 │ │     ││  │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └─────┘│  │
│  └───────────────────┬───────────────────────────┘  │
│                      │ HTTP / WebSocket              │
│  ┌───────────────────┴───────────────────────────┐  │
│  │            FastAPI 后端 (Python)               │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ 图书管理 │ │ 文件解析 │ │  AI 服务调度  │  │  │
│  │  │ 模块     │ │ 模块     │ │  模块         │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ 搜索引擎 │ │ Z-Library│ │  自动更新     │  │  │
│  │  │ 模块     │ │ 模块     │ │  模块         │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  └───────────────────┬───────────────────────────┘  │
│                      │                               │
│  ┌───────────────────┴───────────────────────────┐  │
│  │         嵌入式 PostgreSQL + pgvector           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ 图书元数 │ │ 向量索引 │ │  用户配置     │  │  │
│  │  │ 据表     │ │ 表       │ │  表           │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 2.2 关键设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 架构风格 | 模块化单体 | 桌面应用，部署简单，模块间通过依赖注入解耦 |
| 前端状态管理 | Zustand | 轻量、简单、TypeScript 友好 |
| 通信协议 | REST + WebSocket | REST 用于 CRUD，WebSocket 用于实时进度推送 |
| 数据库部署 | 嵌入式 PostgreSQL | 用户无需手动配置，应用自动启停 |
| AI 服务 | 双轨制 + 首次启动选择 | 云端优先质量，本地保障离线可用 |

---

## 三、前端界面设计

### 3.1 布局方案

采用 **顶部导航 + 侧边栏 + 主内容区** 布局：

```
┌─────────────────────────────────────────────────────┐
│  📚 个人图书管理器    书库  搜索  AI助手  设置       │  ← 一级菜单
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ 书库     │                                          │
│ ├ 全部   │          主内容区                         │
│ ├ 最近   │                                          │
│ └ 收藏   │                                          │
│          │                                          │
│ 书架     │                                          │
│ ├ 技术   │                                          │
│ └ 小说   │                                          │
│          │                                          │
├──────────┴──────────────────────────────────────────┤
│  状态栏：导入进度 / AI 处理状态 / 版本信息           │
└─────────────────────────────────────────────────────┘
  ↑ 二级菜单                ↑ 主内容区
```

### 3.2 页面结构

| 页面 | 一级入口 | 二级/三级内容 |
|------|----------|---------------|
| 书库 | 顶部导航 | 书架视图（网格/列表切换）、书籍详情抽屉（摘要/目录/笔记/推荐） |
| 阅读器 | 书库内打开 | PDF/EPUB 渲染、目录导航、书签/笔记工具栏 |
| AI 助手 | 顶部导航 | 图书分析、内容查询、跨书检索 |
| 搜索 | 顶部导航 | 快速搜索、Z-Library 搜索、高级筛选 |
| 设置 | 顶部导航 | AI 配置、导入管理、书架管理、外观、更新、关于 |

### 3.3 设计风格

- **极简主义**：一级页仅展示核心入口，功能收至二/三级菜单
- **深色主题**：默认深色，支持切换浅色
- **响应式**：适配 1280px+ 分辨率

---

## 四、数据模型

### 4.1 核心表结构

**图书表 (books)**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| title | VARCHAR(500) | 书名 |
| author | VARCHAR(300) | 作者 |
| isbn | VARCHAR(20) | ISBN |
| publisher | VARCHAR(200) | 出版商 |
| publish_date | DATE | 出版日期 |
| cover_url | TEXT | 封面图片路径 |
| file_path | TEXT | 原始文件路径 |
| file_format | VARCHAR(10) | PDF/EPUB/TXT/MOBI/DOCX |
| file_size | BIGINT | 文件大小(bytes) |
| page_count | INTEGER | 页数 |
| reading_status | VARCHAR(20) | unread/reading/finished |
| rating | SMALLINT | 1-5星评分 |
| is_favorite | BOOLEAN | 是否收藏 |
| summary | TEXT | AI 生成的摘要 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

**标签表 (tags)**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | VARCHAR(100) | 标签名，唯一 |
| color | VARCHAR(7) | 标签颜色 #hex |

**图书标签关联 (book_tags)**

| 字段 | 类型 | 说明 |
|------|------|------|
| book_id | UUID | 外键 → books |
| tag_id | UUID | 外键 → tags |

**书架表 (bookshelves)**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | VARCHAR(200) | 书架名 |
| description | TEXT | 描述 |
| sort_order | INTEGER | 排序 |

**书架图书关联 (bookshelf_books)**

| 字段 | 类型 | 说明 |
|------|------|------|
| bookshelf_id | UUID | 外键 → bookshelves |
| book_id | UUID | 外键 → books |

**段落向量表 (passages)**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| book_id | UUID | 外键 → books |
| chapter | VARCHAR(200) | 章节名 |
| page_number | INTEGER | 页码 |
| content | TEXT | 原文内容 |
| embedding | VECTOR(1536) | pgvector 向量 |
| created_at | TIMESTAMP | 创建时间 |

**笔记与书签表 (annotations)**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| book_id | UUID | 外键 → books |
| type | VARCHAR(20) | bookmark/highlight/note |
| page_number | INTEGER | 页码 |
| selected_text | TEXT | 划线文本 |
| note_content | TEXT | 笔记内容 |
| color | VARCHAR(7) | 颜色 |
| created_at | TIMESTAMP | 创建时间 |

**知识卡片表 (knowledge_cards)**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| title | VARCHAR(300) | 卡片标题 |
| content | TEXT | 卡片内容 |
| source_book_id | UUID | 来源书籍 |
| source_passage | TEXT | 原文出处 |
| annotation | TEXT | 用户批注 |
| created_at | TIMESTAMP | 创建时间 |

---

## 五、AI 集成设计

### 5.1 适配器模式

```
┌─────────────────────────────────────┐
│         AI Service Interface        │
│  ┌───────────────────────────────┐  │
│  │  generate_summary(book_text)  │  │
│  │  generate_tags(book_text)     │  │
│  │  semantic_search(query, topk) │  │
│  │  chat(messages, context)      │  │
│  │  get_embedding(text)          │  │
│  └───────────────────────────────┘  │
│              ▲                       │
│    ┌─────────┼─────────┐            │
│    │         │         │            │
│  OpenAI   Claude    Ollama         │
│  Adapter  Adapter   Adapter         │
└─────────────────────────────────────┘
```

### 5.2 AI 处理流程

```
导入图书 → 文件解析 → 文本分块(2000字/块) → 并行处理:
  ├── 生成全书摘要 (取前5000字)
  ├── 生成标签推荐 (取前3000字)
  └── 逐块生成向量嵌入 → 存入 passages 表
```

### 5.3 关键设计

- **首次启动选择**：用户首次打开应用时，弹出选择界面（云端 OpenAI/Claude 或本地 Ollama）
- **随时切换**：设置页面可随时切换 AI 引擎，无需重启
- **API Key 安全**：本地加密存储（AES-256），仅在内存中解密使用
- **向量维度**：统一使用 1536 维（兼容 OpenAI text-embedding-3-small）
- **批量处理**：导入时后台异步生成摘要和向量，通过 WebSocket 推送进度

---

## 六、文件解析管线

### 6.1 解析架构

```
文件导入请求
    │
    ▼
格式检测 (magic bytes + 扩展名)
    │
    ├── PDF  → PyMuPDF/pdfplumber
    ├── EPUB → ebooklib
    ├── TXT  → chardet 编码检测 + 标准库
    ├── MOBI → mobi/ebooklib
    └── DOCX → python-docx
    │
    ▼
统一解析结果 (ParsedBook)
├── metadata: {title, author, isbn, publisher, cover}
├── chapters: [{title, content, page_start, page_end}]
├── full_text: str
├── page_count: int
└── cover_image: bytes
    │
    ▼
后处理管线
├── 文本清洗 (去除乱码、多余空白)
├── 章节识别 (基于标题模式匹配)
├── 文本分块 (2000字/块，重叠200字)
└── 封面提取与缓存
```

### 6.2 批量导入策略

- 拖入文件夹时递归扫描，过滤支持格式
- 使用 asyncio 并发处理（限制并发数=CPU核心数）
- 单文件解析失败不影响其他文件，错误记录到导入日志
- 导入进度通过 WebSocket 实时推送

---

## 七、搜索与向量检索

### 7.1 混合搜索策略

```
用户查询
    │
    ├── 关键词搜索 → PostgreSQL 全文搜索 (tsvector)
    │   └── 适用于: 精确匹配书名、作者、ISBN
    │
    └── 语义搜索 → pgvector 余弦相似度
        └── 适用于: 自然语言提问、跨书检索
```

### 7.2 语义检索流程

```
用户提问 → AI 生成查询向量 → pgvector 近邻搜索(top_k=10) → 返回相关段落
                                                              ↓
                                                    段落来源: book_id + page_number
                                                              ↓
                                                    AI 整合答案 + 标注出处
```

### 7.3 性能优化

- pgvector 使用 HNSW 索引（比 IVFFlat 更适合动态数据）
- 向量维度 1536，百万级段落索引内存占用约 6GB
- 热点查询结果缓存（LRU，最多 1000 条）
- 跨书查询时先按相关度排序，再按书分组展示

---

## 八、Z-Library 集成

### 8.1 双模式接入

```
Z-Library 搜索入口
    │
    ├── 模式1: API/镜像接入 (优先)
    │   └── 对接已知 API 端点，解析 JSON 响应
    │   └── 支持配置镜像地址（应对域名变化）
    │
    └── 模式2: 浏览器内嵌抓取 (备选)
        └── Electron 内嵌 BrowserView
        └── 模拟登录、搜索、下载流程
        └── 自动处理验证码提示（弹窗让用户手动完成）
```

### 8.2 下载流程

搜索 → 选择 → 下载到临时目录 → 自动导入到书库 → 删除临时文件

---

## 九、自动更新

### 9.1 双通道更新

```
更新检查 (启动时 + 每日定时)
    │
    ├── 通道1: GitHub Release API
    │   └── 监听 releases/latest
    │   └── 下载安装包 → 引导用户升级
    │
    └── 通道2: 内嵌更新服务器
        └── 可配置自定义镜像地址
        └── 适合企业/内网环境
```

---

## 十、错误处理策略

| 场景 | 处理方式 |
|------|----------|
| 文件解析失败 | 跳过该文件，记录错误日志，继续处理其他文件 |
| AI 服务不可用 | 降级为无 AI 模式，仅保留基础管理功能 |
| 数据库连接失败 | 重试3次，失败后提示用户检查 |
| 向量搜索超时 | 降级为关键词搜索 |
| 网络断开 | 自动切换到本地 Ollama（如已配置） |
| Z-Library API 不可用 | 自动降级到浏览器抓取模式，提示用户切换镜像地址 |
| Z-Library 下载失败 | 重试2次，失败后提示用户手动下载并导入 |

---

## 十一、项目结构

```
ebook-library/
├── frontend/                  # Electron + React 前端
│   ├── src/
│   │   ├── components/        # 通用组件
│   │   ├── pages/             # 页面组件
│   │   │   ├── Library/       # 书库视图
│   │   │   ├── Reader/        # 阅读器
│   │   │   ├── AiAssistant/   # AI 助手
│   │   │   ├── Search/        # 搜索
│   │   │   └── Settings/      # 设置
│   │   ├── stores/            # Zustand 状态管理
│   │   ├── services/          # API 调用封装
│   │   └── utils/             # 工具函数
│   ├── electron/              # Electron 主进程
│   │   ├── main.ts            # 入口
│   │   ├── preload.ts         # 预加载脚本
│   │   └── ipc-handlers.ts    # IPC 通信处理
│   └── package.json
│
├── backend/                   # FastAPI 后端
│   ├── app/
│   │   ├── api/               # API 路由
│   │   │   ├── books.py       # 图书管理
│   │   │   ├── ai.py          # AI 服务
│   │   │   ├── search.py      # 搜索
│   │   │   └── zlibrary.py    # Z-Library
│   │   ├── core/              # 核心模块
│   │   │   ├── config.py      # 配置管理
│   │   │   ├── database.py    # 数据库连接
│   │   │   └── security.py    # 加密/密钥管理
│   │   ├── models/            # SQLAlchemy 模型
│   │   ├── services/          # 业务逻辑
│   │   │   ├── parser/        # 文件解析器
│   │   │   ├── ai/            # AI 适配器
│   │   │   ├── search/        # 搜索引擎
│   │   │   └── updater/       # 自动更新
│   │   └── schemas/           # Pydantic 模型
│   └── requirements.txt
│
├── docs/                      # 文档
└── scripts/                   # 构建/部署脚本
```

---

## 十二、测试策略

| 层级 | 工具 | 覆盖范围 |
|------|------|----------|
| 单元测试 | pytest | 解析器、AI 适配器、搜索引擎 |
| 集成测试 | pytest + httpx | API 端点、数据库操作 |
| E2E 测试 | Playwright | 关键用户流程（导入、搜索、阅读） |
| 性能测试 | locust | 万册规模检索响应时间 |

**目标覆盖率：** 核心模块 > 80%，API 层 > 90%

---

## 十三、三阶段实施计划

### 第一阶段（MVP）

- [ ] 项目脚手架搭建（Electron + React + FastAPI）
- [ ] 嵌入式 PostgreSQL 集成
- [ ] 本地文件导入（PDF/EPUB/TXT/MOBI/DOCX，单本+批量）
- [ ] 拖拽导入（文件/文件夹拖入窗口）
- [ ] 基础元数据管理（书名、作者、标签）
- [ ] 书架分类与搜索
- [ ] 内置阅读器（PDF/EPUB 基础渲染）
- [ ] 接入 AI 生成摘要（云端优先）
- [ ] 内容语义检索（PostgreSQL + pgvector）
- [ ] Z-Library 搜索与下载接入

### 第二阶段（完善）

- [ ] 自动提取元数据
- [ ] 跨书查询
- [ ] 知识卡片保存
- [ ] 本地 Ollama 离线支持
- [ ] 阅读器增强（目录导航、翻页动画、缩放）

### 第三阶段（增强）

- [ ] 对话式深读
- [ ] 笔记与批注
- [ ] 数据导出（Markdown/PDF）
- [ ] 自动更新（GitHub Release + 内嵌服务器）

---

*文档基于用户需求规格说明书 v0.5 设计，所有决策已确认完毕。*
