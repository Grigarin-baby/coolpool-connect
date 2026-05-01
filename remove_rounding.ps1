Get-ChildItem -Path "src" -Include *.tsx,*.css -Recurse | ForEach-Object {
    $content = [System.IO.File]::ReadAllText($_.FullName)
    $newContent = [regex]::Replace($content, '(?<![a-zA-Z0-9-])rounded(-[a-zA-Z0-9-\[\]]+)?(?![a-zA-Z0-9-])', 'rounded-none')
    if ($content -ne $newContent) {
        [System.IO.File]::WriteAllText($_.FullName, $newContent)
    }
}