[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$dockerEnvPath = Join-Path $root "docker.env"
$composeEnvPath = Join-Path $root ".env"

if ((Test-Path -LiteralPath $dockerEnvPath) -or (Test-Path -LiteralPath $composeEnvPath)) {
    throw "Runtime configuration already exists. Refusing to overwrite secrets."
}

function New-HexSecret([int]$ByteCount) {
    $bytes = [byte[]]::new($ByteCount)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    }
    finally {
        $rng.Dispose()
    }
    return ([BitConverter]::ToString($bytes) -replace "-", "").ToLowerInvariant()
}

$secretKey = New-HexSecret 32
$utilsSecret = New-HexSecret 32
$postgresPassword = New-HexSecret 24

$dockerEnv = Get-Content -Raw -LiteralPath (Join-Path $root "docker.env.template")
$dockerEnv = $dockerEnv.Replace("__SECRET_KEY__", $secretKey)
$dockerEnv = $dockerEnv.Replace("__UTILS_SECRET__", $utilsSecret)
$dockerEnv = $dockerEnv.Replace("__POSTGRES_PASSWORD__", $postgresPassword)

$composeEnv = Get-Content -Raw -LiteralPath (Join-Path $root ".env.template")
$composeEnv = $composeEnv.Replace("__POSTGRES_PASSWORD__", $postgresPassword)

[System.IO.File]::WriteAllText($dockerEnvPath, $dockerEnv, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($composeEnvPath, $composeEnv, [System.Text.UTF8Encoding]::new($false))

Write-Output "Generated local Outline runtime configuration."
