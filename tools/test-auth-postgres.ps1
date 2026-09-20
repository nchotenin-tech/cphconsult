$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$testRoot = Join-Path $projectRoot ('.local-tests\auth-' + [Guid]::NewGuid().ToString('N'))
$clusterPath = Join-Path $testRoot 'data'
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$started = $false
Push-Location $projectRoot
try {
    # Disposable empty cluster: local loopback only, synthetic data, no password reuse.
    & "$pgBin\initdb.exe" -D $clusterPath -U postgres -A trust --encoding=UTF8 --no-locale
    if ($LASTEXITCODE -ne 0) { throw 'Test initdb failed' }
    & "$pgBin\pg_ctl.exe" -D $clusterPath -l (Join-Path $testRoot 'server.log') -o '-h 127.0.0.1 -p 55439' -w start
    if ($LASTEXITCODE -ne 0) { throw 'Test cluster start failed; check test port 55439' }
    $started = $true
    & "$pgBin\createdb.exe" -h 127.0.0.1 -p 55439 -U postgres cphconsult_dev
    if ($LASTEXITCODE -ne 0) { throw 'Test database creation failed' }
    foreach ($migration in @('01-development-foundation.sql','03-identity-schema.sql','05-auth-functions.sql','06-clinical-read-schema.sql')) {
        & "$pgBin\psql.exe" -X -h 127.0.0.1 -p 55439 -U postgres -d cphconsult_dev -v ON_ERROR_STOP=1 -f (Join-Path $projectRoot "ops\postgres\$migration")
        if ($LASTEXITCODE -ne 0) { throw "Test migration failed: $migration" }
    }
    & node server/test/auth-postgres.mjs
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL HTTP integration failed' }
    & node server/test/clinical-postgres.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Clinical PostgreSQL HTTP integration failed' }
}
finally {
    if ($started) { & "$pgBin\pg_ctl.exe" -D $clusterPath -m fast -w stop }
    Pop-Location
}
