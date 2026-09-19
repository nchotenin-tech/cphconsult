param([switch]$VerifyIdentity)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
$savedDatabaseUrl = $env:DATABASE_URL
$savedHost = $env:HOST
$savedPort = $env:PORT
$passwordPointer = [IntPtr]::Zero
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed. Password was not requested.' }
    Write-Host 'Local database: 127.0.0.1:5432/cphconsult_dev'
    Write-Host 'Account: cphconsult_dev_runtime. Password is not saved to a file.'
    $securePassword = Read-Host 'PostgreSQL application password' -AsSecureString
    if ($securePassword.Length -eq 0) { throw 'A password is required.' }
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $encodedPassword = [Uri]::EscapeDataString([Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer))
    $env:DATABASE_URL = 'postgresql://cphconsult_dev_runtime:' + $encodedPassword + '@127.0.0.1:5432/cphconsult_dev'
    $encodedPassword = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    $passwordPointer = [IntPtr]::Zero
    $securePassword.Dispose()
    $env:HOST = '127.0.0.1'
    $env:PORT = '3100'
    & node tools/check-local-database.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Database preflight failed. The API was not started.' }
    if ($VerifyIdentity) {
        & node tools/verify-runtime-identity.mjs
        if ($LASTEXITCODE -ne 0) { throw 'Runtime identity checks failed. See the safe check label above.' }
    }
    else {
        Write-Host 'Starting API at http://127.0.0.1:3100. Stop with Ctrl+C.'
        & node dist/main.js
        if ($LASTEXITCODE -ne 0) { throw 'API exited with an error.' }
    }
}
finally {
    if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
    $env:DATABASE_URL = $savedDatabaseUrl
    $env:HOST = $savedHost
    $env:PORT = $savedPort
    Pop-Location
}
