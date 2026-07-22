$ErrorActionPreference = "Stop"

$TokenFile = Join-Path $PSScriptRoot "outline-token.txt"
$Token = Read-Host "Paste the Outline API token (input stays only in this PowerShell process)"
$Token = $Token.Trim()

if ([string]::IsNullOrWhiteSpace($Token)) {
    throw "No token was entered."
}

if (-not $Token.StartsWith("ol_api_")) {
    Write-Warning "The token does not start with ol_api_. It will still be saved, but verify that you copied the complete Outline API token."
}

$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($TokenFile, $Token, $Utf8NoBom)

Write-Host "Outline token saved to: $TokenFile"
Write-Host "Do not commit, upload, screenshot, or share this file."
