# Contributing

## Development setup
### Python
```bash
cd deforum_core
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -U pip
pip install -e ".[dev]"
pytest -q
```

### Web editor
```bash
cd web_editor
npm install
npm run dev
npm run build
```

## Code style
- Python: `ruff` + `mypy` + `pytest`
- TypeScript: `tsc` (strict)

## Pull requests
- Keep PRs focused and small.
- Add tests for any core timeline/camera changes.
