$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodePath = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
try {
    if (-not $nodePath -or -not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js was not found. Install Node.js 22.12 or later, then try again.' }
    $env:PATH = (Split-Path -Parent $nodePath) + ';' + $env:PATH
    & $nodePath scripts/dev.mjs *> launch.log
    if ($LASTEXITCODE -ne 0) { throw 'Live Canvas could not start. See launch.log in this folder.' }
} catch {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($_.Exception.Message, 'Live Canvas') | Out-Null
}
