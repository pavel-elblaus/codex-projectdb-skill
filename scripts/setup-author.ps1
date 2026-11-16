[CmdletBinding()]
param(
    [string]$SkillHome = $(if ($env:CODEX_HOME) { Join-Path $env:CODEX_HOME 'skills' } else { Join-Path $env:USERPROFILE '.codex\skills' })
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$gitSafeDirectory = $repoRoot.Replace('\', '/')
$skillTarget = [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'plugins\projectdb\skills\projectdb-constructor'))
$skillHomePath = [System.IO.Path]::GetFullPath($SkillHome)
$skillLink = [System.IO.Path]::GetFullPath((Join-Path $skillHomePath 'projectdb-constructor'))
if (-not $skillTarget.StartsWith($repoRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid repository skill path.' }
if ([System.IO.Path]::GetDirectoryName($skillLink) -ne $skillHomePath) { throw 'Invalid installed skill path.' }
if (-not (Test-Path -LiteralPath (Join-Path $skillTarget 'SKILL.md'))) { throw 'Repository skill not found.' }

function Invoke-RepoGit {
    param([string[]]$GitArgs)
    & git -c "safe.directory=$gitSafeDirectory" -C $repoRoot @GitArgs
    if ($LASTEXITCODE -ne 0) { throw "Git failed: $($GitArgs -join ' ')" }
}

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot '.git'))) { Invoke-RepoGit -GitArgs @('init', '--initial-branch=main') }
if ((Invoke-RepoGit -GitArgs @('symbolic-ref', '--short', 'HEAD')) -ne 'main') { throw 'Switch to the main branch before setup.' }
$manifest = Get-Content -LiteralPath (Join-Path $repoRoot 'plugins\projectdb\plugin.json') -Raw | ConvertFrom-Json
$remote = & git -c "safe.directory=$gitSafeDirectory" -C $repoRoot config --get remote.origin.url
if ($LASTEXITCODE -ne 0) { Invoke-RepoGit -GitArgs @('remote', 'add', 'origin', ($manifest.repository + '.git')) }
elseif ($remote.TrimEnd('/').Replace('.git', '') -ne $manifest.repository) { throw 'Unexpected origin; inspect it before setup.' }
Invoke-RepoGit -GitArgs @('fetch', 'origin', 'main')
& git -c "safe.directory=$gitSafeDirectory" -C $repoRoot rev-parse --verify --quiet HEAD | Out-Null
if ($LASTEXITCODE -ne 0) { Invoke-RepoGit -GitArgs @('reset', '--mixed', 'origin/main') }
else { Invoke-RepoGit -GitArgs @('pull', '--ff-only', 'origin', 'main') }
Invoke-RepoGit -GitArgs @('branch', '--set-upstream-to=origin/main', 'main')
$pending = Invoke-RepoGit -GitArgs @('status', '--porcelain', '--untracked-files=all')
if ($pending) { throw 'Review local changes before linking the installed skill.' }
& node (Join-Path $repoRoot 'scripts\validate.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Plugin validation failed.' }

New-Item -ItemType Directory -Path $skillHomePath -Force | Out-Null
$existing = Get-Item -LiteralPath $skillLink -Force -ErrorAction SilentlyContinue
if ($existing -and ($existing.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    if ([System.IO.Path]::GetFullPath([string]@($existing.Target)[0]) -ne $skillTarget) { throw 'The installed skill already links to another location.' }
} else {
    if ($existing) {
        $backupRoot = [System.IO.Path]::GetFullPath((Join-Path $skillHomePath '..\skill-backups'))
        $backupPath = [System.IO.Path]::GetFullPath((Join-Path $backupRoot ('projectdb-constructor-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))))
        if (-not $backupPath.StartsWith($backupRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid backup path.' }
        New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
        Move-Item -LiteralPath $skillLink -Destination $backupPath
        Write-Output "Previous skill preserved at: $backupPath"
    }
    try { New-Item -ItemType Junction -Path $skillLink -Target $skillTarget | Out-Null }
    catch {
        if ($backupPath -and -not (Test-Path -LiteralPath $skillLink)) { Move-Item -LiteralPath $backupPath -Destination $skillLink }
        throw
    }
}
Invoke-RepoGit -GitArgs @('config', '--local', 'projectdb.autoPublish', 'true')
Write-Output "Active skill: $skillLink -> $skillTarget"
Write-Output 'Author mode enabled. Codex publishes completed skill edits with: node scripts/publish.mjs --auto'
