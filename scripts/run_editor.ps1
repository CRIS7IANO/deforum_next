\
# PowerShell helper to run the editor on Windows
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Push-Location (Join-Path $PSScriptRoot "..\web_editor")
npm install
npm run dev
Pop-Location
