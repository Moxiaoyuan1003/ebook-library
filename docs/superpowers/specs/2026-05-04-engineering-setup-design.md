# Engineering Setup Design

> Document status: Confirmed | Date: 2026-05-04 | Version: v1.0

---

## Overview

Add engineering infrastructure: code linting/formatting, CI/CD pipeline, Dockerfile, and environment variable management.

---

## 1. Code Linting & Formatting

### 1.1 Frontend: ESLint + Prettier

**ESLint** — extend existing TypeScript config with:
- `@typescript-eslint/recommended`
- `eslint-plugin-react` / `eslint-plugin-react-hooks`
- Rules: no unused vars (warn), no explicit any (warn), consistent imports

**Prettier** — enforce consistent formatting:
- Semi: true
- Single quote: true
- Trailing comma: all
- Print width: 100

**Scripts:**
```json
"lint": "eslint src/ --ext .ts,.tsx",
"lint:fix": "eslint src/ --ext .ts,.tsx --fix",
"format": "prettier --write \"src/**/*.{ts,tsx,css,json}\"",
"format:check": "prettier --check \"src/**/*.{ts,tsx,css,json}\""
```

### 1.2 Backend: Ruff

**Ruff** — fast Python linter + formatter (replaces flake8 + black + isort):
- Line length: 120
- Rules: E, F, W, I (isort), UP (pyupgrade)
- Format: double quotes, trailing commas

**Config in `pyproject.toml`:**
```toml
[tool.ruff]
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP"]

[tool.ruff.format]
quote-style = "double"
```

**Scripts (Makefile):**
```makefile
lint:
	ruff check app/ tests/
format:
	ruff format app/ tests/
check: lint test
```

---

## 2. Pre-commit Hooks

**`.pre-commit-config.yaml`:**
- Frontend: `npm run lint:fix` + `npm run format` on staged `.ts/.tsx` files
- Backend: `ruff check --fix` + `ruff format` on staged `.py` files
- Trailing whitespace, end-of-file fixer

Simple approach: use a `pre-commit` npm script that runs both linters.

---

## 3. CI/CD: GitHub Actions

**`.github/workflows/ci.yml`:**

Triggers: push to main, pull requests to main.

Jobs:

### 3.1 Frontend Job
```yaml
- Checkout
- Setup Node 20
- npm ci
- npm run lint
- npm run format:check
- npx tsc --noEmit
- npx vitest run
```

### 3.2 Backend Job
```yaml
- Checkout
- Setup Python 3.11
- pip install -r requirements.txt
- pip install ruff
- ruff check app/ tests/
- ruff format --check app/ tests/
- python -m pytest tests/ -v
```

---

## 4. Dockerfile

Multi-stage build for the full application:

**`Dockerfile`:**
```dockerfile
# Backend
FROM python:3.11-slim as backend
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .

# Frontend
FROM node:20-slim as frontend
WORKDIR /app
COPY frontend/package*.json .
RUN npm ci
COPY frontend/ .
RUN npm run build

# Production
FROM python:3.11-slim
WORKDIR /app
COPY --from=backend /app /app/backend
COPY --from=frontend /app/dist /app/frontend/dist
EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**`.dockerignore`:**
```
node_modules
__pycache__
.git
.pytest_cache
*.pyc
.env
```

---

## 5. Environment Variable Management

### 5.1 Backend

**`.env.example`:**
```
DATABASE_URL=postgresql://user:pass@localhost:5432/ebook_library
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
CLAUDE_API_KEY=sk-ant-xxx
OLLAMA_BASE_URL=http://localhost:11434
SECRET_KEY=change-me-in-production
```

**`.gitignore` addition:** `.env` already in `.gitignore` — verify.

### 5.2 Frontend

No secrets in frontend. API base URL via vite proxy (already configured).

---

## File Change Summary

### New Files

| File | Responsibility |
|------|---------------|
| `frontend/.eslintrc.cjs` | ESLint config |
| `frontend/.prettierrc` | Prettier config |
| `backend/pyproject.toml` | Ruff config |
| `backend/Makefile` | Backend dev commands |
| `.github/workflows/ci.yml` | CI pipeline |
| `Dockerfile` | Container build |
| `.dockerignore` | Docker ignore rules |
| `.env.example` | Environment template |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/package.json` | Add lint/format scripts + deps |
| `.gitignore` | Verify .env excluded |

---

## Spec Self-Review

1. **Placeholder scan:** No TBDs. ✅
2. **Internal consistency:** All tools compatible with existing stack. ✅
3. **Scope check:** 4 independent subsystems (lint, CI, Docker, env) — appropriate for one plan. ✅
4. **Ambiguity check:** Each section has concrete config. ✅
