[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$dockerEnvPath = Join-Path $root "docker.env"
$dexConfigPath = Join-Path $root "dex-config.yaml"
$credentialsPath = Join-Path $root "local-admin-credentials.txt"

if (-not (Test-Path -LiteralPath $dockerEnvPath)) {
    throw "Run Initialize-OutlineConfig.ps1 first."
}

if ((Test-Path -LiteralPath $dexConfigPath) -or (Test-Path -LiteralPath $credentialsPath)) {
    throw "Local OIDC configuration already exists. Refusing to overwrite credentials."
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

$adminEmail = "admin@local.test"
$adminPassword = "Rc!" + (New-HexSecret 12)
$clientSecret = New-HexSecret 32

$hashLine = & docker run --rm httpd:2.4-alpine htpasswd -bnBC 12 admin $adminPassword
if ($LASTEXITCODE -ne 0) {
    throw "Failed to generate the local OIDC password hash."
}

$passwordHash = (($hashLine -join "").Trim() -split ":", 2)[1]
if (-not $passwordHash) {
    throw "The password hashing tool returned an unexpected result."
}
$passwordHash = $passwordHash -replace '^\$2y\$', '$2a$'

$dexConfig = @"
issuer: http://localhost:5556/dex

storage:
  type: sqlite3
  config:
    file: /var/dex/dex.db

web:
  http: 0.0.0.0:5556

oauth2:
  skipApprovalScreen: true

staticClients:
  - id: outline
    name: Outline
    secret: '$clientSecret'
    redirectURIs:
      - http://localhost:3000/auth/oidc.callback

enablePasswordDB: true

staticPasswords:
  - email: '$adminEmail'
    hash: '$passwordHash'
    username: Local Admin
    userID: 8b9d1e26-f36a-4cc3-9f4d-573f377dc048
"@

$oidcEnvironment = @"

OIDC_CLIENT_ID=outline
OIDC_CLIENT_SECRET=$clientSecret
OIDC_AUTH_URI=http://localhost:5556/dex/auth
OIDC_TOKEN_URI=http://dex:5556/dex/token
OIDC_USERINFO_URI=http://dex:5556/dex/userinfo
OIDC_LOGOUT_URI=http://localhost:5556/dex
OIDC_USERNAME_CLAIM=preferred_username
OIDC_DISPLAY_NAME=Local Sign-In
OIDC_SCOPES=openid profile email
"@

$credentials = @"
Local Outline prototype administrator
Email: $adminEmail
Password: $adminPassword
Outline: http://127.0.0.1:3000
"@

[System.IO.File]::WriteAllText($dexConfigPath, $dexConfig, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::AppendAllText($dockerEnvPath, $oidcEnvironment, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($credentialsPath, $credentials, [System.Text.UTF8Encoding]::new($false))

Write-Output "Generated local OIDC configuration and administrator credentials."
