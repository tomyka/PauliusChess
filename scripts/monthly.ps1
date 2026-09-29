# Monthly job, run by Windows Task Scheduler on the 2nd (see README).
# ratings.fide.com refuses connections from GitHub's runners, so the fetch runs here;
# the push then triggers the GitHub workflow that tests and republishes the page.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
Start-Transcript -Path "$PSScriptRoot\monthly.log" -Append | Out-Null
try {
  git pull --ff-only
  if ($LASTEXITCODE) { throw "git pull failed" }
  node scripts/update.mjs
  if ($LASTEXITCODE) { throw "update failed" }
  git add site/data.json
  git diff --cached --quiet
  if ($LASTEXITCODE) {
    git commit -m "data: FIDE ratings $(Get-Date -Format yyyy-MM-dd)"
    git push
    if ($LASTEXITCODE) { throw "git push failed" }
  } else {
    'No rating changes'
  }
} finally {
  Stop-Transcript | Out-Null
}
