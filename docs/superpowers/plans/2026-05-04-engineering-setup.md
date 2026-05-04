# Engineering Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ESLint + Prettier (frontend), Ruff (backend), GitHub Actions CI, Dockerfile, and .env.example.

**Architecture:** Each engineering tool is independent. Tasks are ordered by dependency (lint config before CI that runs lint).

**Tech Stack:** ESLint, Prettier, Ruff, GitHub Actions, Docker, Makefile

---

## Task 1: Frontend ESLint + Prettier

**Files:**
- Create: `frontend/.eslintrc.cjs`
- Create: `frontend/.prettierrc`
- Modify: `frontend/package.json`

- [ ] **Step 1: Install dependencies**

Run: `cd f:/Code/ebook-library/frontend && npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks prettier`

- [ ] **Step 2: Create ESLint config**

Create `frontend/.eslintrc.cjs`:

```javascript
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'electron'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: 'detect' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/react-in-jsx-scope': 'off',
  },
};
```

- [ ] **Step 3: Create Prettier config**

Create `frontend/.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

- [ ] **Step 4: Add scripts to package.json**

Add to `frontend/package.json` scripts:

```json
"lint": "eslint src/ --ext .ts,.tsx",
"lint:fix": "eslint src/ --ext .ts,.tsx --fix",
"format": "prettier --write \"src/**/*.{ts,tsx,css,json}\"",
"format:check": "prettier --check \"src/**/*.{ts,tsx,css,json}\""
```

- [ ] **Step 5: Run lint and fix issues**

Run: `cd f:/Code/ebook-library/frontend && npm run lint:fix && npm run format`
Expected: Some warnings, no errors. Auto-fixable issues fixed.

- [ ] **Step 6: Commit**

```bash
cd f:/Code/ebook-library && git add frontend/.eslintrc.cjs frontend/.prettierrc frontend/package.json frontend/package-lock.json
git commit -m "chore: add ESLint and Prettier to frontend"
```

---

## Task 2: Backend Ruff

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/Makefile`

- [ ] **Step 1: Install Ruff**

Run: `pip install ruff`

- [ ] **Step 2: Create pyproject.toml**

Create `backend/pyproject.toml`:

```toml
[tool.ruff]
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP"]

[tool.ruff.format]
quote-style = "double"
```

- [ ] **Step 3: Create Makefile**

Create `backend/Makefile`:

```makefile
.PHONY: lint format test check

lint:
	ruff check app/ tests/

format:
	ruff format app/ tests/

test:
	python -m pytest tests/ -v

check: lint test
```

- [ ] **Step 4: Run lint and fix issues**

Run: `cd f:/Code/ebook-library/backend && ruff check app/ tests/ --fix && ruff format app/ tests/`
Expected: Auto-fixable issues fixed.

- [ ] **Step 5: Commit**

```bash
cd f:/Code/ebook-library && git add backend/pyproject.toml backend/Makefile
git commit -m "chore: add Ruff linter and formatter to backend"
```

---

## Task 3: .env.example

**Files:**
- Create: `.env.example`
- Modify: `.gitignore` (verify)

- [ ] **Step 1: Create .env.example**

Create `.env.example` in project root:

```
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ebook_library

# AI Provider (openai | claude | ollama)
AI_PROVIDER=openai

# API Keys
OPENAI_API_KEY=sk-xxx
CLAUDE_API_KEY=sk-ant-xxx

# Ollama (if using local AI)
OLLAMA_BASE_URL=http://localhost:11434

# Security
SECRET_KEY=change-me-in-production
```

- [ ] **Step 2: Verify .gitignore**

Read `.gitignore` and verify `.env` is listed. If not, add it.

- [ ] **Step 3: Commit**

```bash
cd f:/Code/ebook-library && git add .env.example .gitignore
git commit -m "chore: add .env.example template"
```

---

## Task 4: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npx tsc --noEmit
      - run: npx vitest run

  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements.txt
      - run: pip install ruff
      - run: ruff check app/ tests/
      - run: ruff format --check app/ tests/
      - run: python -m pytest tests/ -v
```

- [ ] **Step 2: Verify YAML syntax**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd f:/Code/ebook-library && git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions CI pipeline"
```

---

## Task 5: Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create Dockerfile**

Create `Dockerfile`:

```dockerfile
# Backend
FROM python:3.11-slim AS backend
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .

# Frontend
FROM node:20-slim AS frontend
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Production
FROM python:3.11-slim
WORKDIR /app
COPY --from=backend /app /app/backend
COPY --from=frontend /app/dist /app/frontend/dist
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create .dockerignore**

Create `.dockerignore`:

```
node_modules
__pycache__
.git
.pytest_cache
*.pyc
.env
*.egg-info
dist
build
```

- [ ] **Step 3: Commit**

```bash
cd f:/Code/ebook-library && git add Dockerfile .dockerignore
git commit -m "chore: add Dockerfile for containerized deployment"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Run frontend lint + format check**

Run: `cd f:/Code/ebook-library/frontend && npm run lint && npm run format:check`
Expected: Clean or warnings only.

- [ ] **Step 2: Run backend lint + format check**

Run: `cd f:/Code/ebook-library/backend && ruff check app/ tests/ && ruff format --check app/ tests/`
Expected: Clean.

- [ ] **Step 3: Run all tests**

Run: `cd f:/Code/ebook-library/backend && python -m pytest tests/ -q`
Expected: All tests pass.

Run: `cd f:/Code/ebook-library/frontend && npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Verify CI YAML**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('CI YAML OK')"`

---

## Spec Coverage

| Spec Requirement | Task |
|------------------|------|
| ESLint + Prettier (frontend) | Task 1 |
| Ruff (backend) | Task 2 |
| Pre-commit scripts | Task 1 (lint:fix) + Task 2 (Makefile) |
| GitHub Actions CI | Task 4 |
| Dockerfile | Task 5 |
| .env.example | Task 3 |
| .gitignore verification | Task 3 |
