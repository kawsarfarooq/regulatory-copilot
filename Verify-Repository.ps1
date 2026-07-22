[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Push-Location $root

try {
    node --check .\outline-mcp\outline_mcp_server.mjs
    node --check .\evaluation\run-retrieval-eval.mjs

    Get-Content .\evaluation\cases.json -Raw | ConvertFrom-Json | Out-Null
    Get-Content .\evaluation\results\latest.json -Raw | ConvertFrom-Json | Out-Null

    $parseFailures = @()
    Get-ChildItem -LiteralPath $root -Recurse -Filter *.ps1 | ForEach-Object {
        $tokens = $null
        $errors = $null
        [System.Management.Automation.Language.Parser]::ParseFile(
            $_.FullName,
            [ref]$tokens,
            [ref]$errors
        ) | Out-Null
        if ($errors.Count) {
            $parseFailures += $errors
        }
    }
    if ($parseFailures.Count) {
        throw "PowerShell syntax validation failed: $($parseFailures | Out-String)"
    }

    docker compose `
        --env-file .\outline-runtime\.env.template `
        -f .\outline-runtime\compose.yaml `
        config --no-interpolate | Out-Null

    $secretChecks = @(
        @{ Pattern = 'ol_api_[A-Za-z0-9]{20,}'; Allowed = $null },
        @{ Pattern = 'apiKey:\s*"[^"\r\n]+"'; Allowed = 'REPLACE_WITH_CURRENT_VLLM_API_KEY' },
        @{ Pattern = 'VLLM_API_KEY\s*=\s*\S+'; Allowed = 'REPLACE_WITH_' },
        @{ Pattern = 'SECRET_KEY\s*=\s*\S+'; Allowed = '__SECRET_KEY__' },
        @{ Pattern = 'POSTGRES_PASSWORD\s*=\s*\S+'; Allowed = '__POSTGRES_PASSWORD__' }
    )
    foreach ($check in $secretChecks) {
        $hits = @(& rg -n --hidden -P $check.Pattern . 2>$null)
        if ($LASTEXITCODE -gt 1) {
            throw "Secret scan failed for pattern '$($check.Pattern)'."
        }
        if ($check.Allowed) {
            $hits = @($hits | Where-Object { $_ -notmatch [regex]::Escape($check.Allowed) })
        }
        if ($hits.Count) {
            throw "Potential secret matched '$($check.Pattern)':`n$($hits -join "`n")"
        }
    }

    $forbiddenNames = @(
        '.env',
        'docker.env',
        'dex-config.yaml',
        'local-admin-credentials.txt',
        'outline-token.txt'
    )
    $forbiddenFiles = Get-ChildItem -LiteralPath $root -Recurse -Force -File |
        Where-Object { $forbiddenNames -contains $_.Name }
    if ($forbiddenFiles) {
        throw "Forbidden runtime secret files found:`n$($forbiddenFiles.FullName -join "`n")"
    }

    Write-Output "Repository verification passed."
}
finally {
    Pop-Location
}
