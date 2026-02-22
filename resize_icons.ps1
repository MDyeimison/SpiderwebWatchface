Add-Type -AssemblyName System.Drawing

$icons = @('heart.png','steps.png','cal.png','dist.png','stress.png','spo2.png')
$dirs  = @(
    'c:\Users\Eysuu\Documents\Projects\SpiderwebWatchface\assets\bip-6',
    'c:\Users\Eysuu\Documents\Projects\SpiderwebWatchface\assets\bip-6.r'
)
$newSize = 42

foreach ($dir in $dirs) {
    foreach ($name in $icons) {
        $path = Join-Path $dir $name
        if (!(Test-Path $path)) { Write-Output "Missing: $path"; continue }

        $src = [System.Drawing.Image]::FromFile($path)
        Write-Output ("$name original: " + $src.Width + "x" + $src.Height)

        $bmp = New-Object System.Drawing.Bitmap($newSize, $newSize)
        $g   = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($src, 0, 0, $newSize, $newSize)
        $g.Dispose()
        $src.Dispose()

        $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Output "Resized: $path -> ${newSize}x${newSize}"
    }
}

Write-Output "Done!"
