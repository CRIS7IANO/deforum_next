\
# PowerShell helper to run the bridge on Windows
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Push-Location (Join-Path $PSScriptRoot "..\deforum_core")
if (!(Test-Path ".\.venv")) {
  python -m venv .venv
}
.\.venv\Scripts\python.exe -m pip install -U pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\deforumx.exe serve ..\examples\project.defx --port 8787
Pop-Location
