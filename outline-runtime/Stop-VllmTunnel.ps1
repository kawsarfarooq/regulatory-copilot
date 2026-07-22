[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$pidPath = Join-Path $PSScriptRoot "ssh-tunnel.pid"

if (-not (Test-Path -LiteralPath $pidPath)) {
    Write-Output "No managed vLLM SSH tunnel PID file exists."
    exit 0
}

$tunnelPid = [int](Get-Content -Raw -LiteralPath $pidPath)
$process = Get-Process -Id $tunnelPid -ErrorAction SilentlyContinue
if ($process) {
    if ($process.ProcessName -notin @("ssh", "ssh.exe")) {
        throw "PID $tunnelPid is not an SSH process; refusing to stop it."
    }
    Stop-Process -Id $tunnelPid
    Write-Output "Stopped managed vLLM SSH tunnel (PID $tunnelPid)."
}
else {
    Write-Output "The recorded SSH tunnel process is no longer running."
}

Remove-Item -LiteralPath $pidPath -Force
