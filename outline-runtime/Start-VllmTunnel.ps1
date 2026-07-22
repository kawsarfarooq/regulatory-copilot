[CmdletBinding()]
param(
    [string]$SshHost = "gpu-server",
    [int]$LocalPort = 8000
)

$ErrorActionPreference = "Stop"
$pidPath = Join-Path $PSScriptRoot "ssh-tunnel.pid"

if (Test-Path -LiteralPath $pidPath) {
    $existingPid = [int](Get-Content -Raw -LiteralPath $pidPath)
    if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
        Write-Output "The managed vLLM SSH tunnel is already running (PID $existingPid)."
        exit 0
    }
    Remove-Item -LiteralPath $pidPath -Force
}

$listener = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    throw "Local port $LocalPort is already in use by PID $($listener[0].OwningProcess)."
}

$arguments = @(
    "-N",
    "-T",
    "-o", "ExitOnForwardFailure=no",
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=3",
    "-L", "${LocalPort}:127.0.0.1:8000",
    $SshHost
)

$process = Start-Process -FilePath "ssh.exe" -ArgumentList $arguments -WindowStyle Hidden -PassThru
[System.IO.File]::WriteAllText($pidPath, [string]$process.Id, [System.Text.UTF8Encoding]::new($false))

$deadline = (Get-Date).AddSeconds(20)
do {
    Start-Sleep -Milliseconds 500
    if ($process.HasExited) {
        Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
        throw "The SSH tunnel exited before becoming ready."
    }
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$LocalPort/health" -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Write-Output "vLLM SSH tunnel is healthy on http://127.0.0.1:$LocalPort (PID $($process.Id))."
            exit 0
        }
    }
    catch {
        # Continue polling until the deadline.
    }
} while ((Get-Date) -lt $deadline)

Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
throw "vLLM did not become reachable through the SSH tunnel within 20 seconds."
