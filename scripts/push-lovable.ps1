# Push to the Lovable-linked GitHub repo without using the local gh/keyring account.
# Lovable Cloud watches origin/main and redeploys frontend + Supabase edge functions.
#
# Usage:
#   $env:GITHUB_PAT = "ghp_..."
#   .\scripts\push-lovable.ps1
#
# Optional:
#   .\scripts\push-lovable.ps1 -Branch main -RemoteRepo Gplobato/comfortplus-your-cool-oasis

param(
  [string]$Branch = "main",
  [string]$RemoteRepo = "Gplobato/comfortplus-your-cool-oasis"
)

$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git\cmd\git.exe"
if (-not (Test-Path $git)) { $git = "git" }

$tok = $env:GITHUB_PAT
if (-not $tok) {
  Write-Error "Defina GITHUB_PAT no ambiente (PAT do dono do repositório Lovable)."
}

$env:GIT_TERMINAL_PROMPT = "0"
$url = "https://x-access-token:${tok}@github.com/${RemoteRepo}.git"

Write-Host "Fetching $RemoteRepo ($Branch)..."
& $git -C (Resolve-Path "$PSScriptRoot\..") -c credential.helper= fetch $url "${Branch}:refs/remotes/origin/${Branch}"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Pushing HEAD -> origin/$Branch (Lovable auto-deploy)..."
& $git -C (Resolve-Path "$PSScriptRoot\..") -c credential.helper= push $url "HEAD:${Branch}"
$code = $LASTEXITCODE

if ($code -eq 0) {
  & $git -C (Resolve-Path "$PSScriptRoot\..") -c credential.helper= fetch $url "${Branch}:refs/remotes/origin/${Branch}"
  Write-Host "OK. Lovable deve redeployar edge functions e migrations do projeto rqdrdcwnxwcfvqxukrbx."
}

Remove-Variable tok, url -ErrorAction SilentlyContinue
exit $code
