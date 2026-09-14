$ErrorActionPreference = 'Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'InputBridge.cs')
[LiveCanvas.InputBridge]::Run()
