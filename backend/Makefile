.PHONY: lint format test check

lint:
	ruff check app/ tests/

format:
	ruff format app/ tests/

test:
	python -m pytest tests/ -v

check: lint test
