$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
$savedAdmin = $env:CPH_LOCAL_ADMIN_PASSWORD
$savedPassword = $env:CPH_TEST_PASSWORD
function Read-LocalSecret([string]$label) {
    $secret = Read-Host $label -AsSecureString
    $pointer = [IntPtr]::Zero
    try {
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
        $secret.Dispose()
    }
}
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
    Write-Host 'Creates tester@example.invalid in local cphconsult_dev only. Existing accounts are never overwritten.'
    $env:CPH_LOCAL_ADMIN_PASSWORD = Read-LocalSecret 'Local PostgreSQL postgres password (not the application account password)'
    $env:CPH_TEST_PASSWORD = Read-LocalSecret 'Choose a NEW application test password (at least 12 characters)'
    $confirmation = Read-LocalSecret 'Repeat the NEW application test password'
    if ($confirmation -cne $env:CPH_TEST_PASSWORD) { throw 'Passwords do not match. No changes made.' }
    $confirmation = $null
    & node tools/create-test-user.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Test account creation failed; see the safe error above.' }
}
finally {
    $env:CPH_LOCAL_ADMIN_PASSWORD = $savedAdmin
    $env:CPH_TEST_PASSWORD = $savedPassword
    $confirmation = $null
    Pop-Location
}
