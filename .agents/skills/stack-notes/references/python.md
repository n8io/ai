# Python

- Use `uv` for environments and installs (`uv sync`, `uv run`), never bare `pip`/`pip3`.
- Toolchain gate: the pin is `.python-version` or `requires-python`; `uv` honours it. Print
  `uv run python --version` and compare.
