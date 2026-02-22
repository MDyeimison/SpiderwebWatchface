Add-Type -AssemblyName System.Drawing

$outDir1 = "c:\Users\Eysuu\Documents\Projects\SpiderwebWatchface\assets\bip-6\walking_guy"
$outDir2 = "c:\Users\Eysuu\Documents\Projects\SpiderwebWatchface\assets\bip-6.r\walking_guy"
$gifPath  = "c:\Users\Eysuu\Documents\Projects\SpiderwebWatchface\assets\bip-6\walking_guy.gif"

# Smaller size to fit in bottom-right corner empty space
$newW = 75
$newH = 107

$img   = [System.Drawing.Image]::FromFile($gifPath)
$fd    = New-Object System.Drawing.Imaging.FrameDimension($img.FrameDimensionsList[0])
$count = $img.GetFrameCount($fd)

Write-Output "Resizing $count frames to ${newW}x${newH}..."

for ($i = 0; $i -lt $count; $i++) {
    $img.SelectActiveFrame($fd, $i)

    $bmp = New-Object System.Drawing.Bitmap($newW, $newH)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $newW, $newH)
    $g.Dispose()

    $bmp.Save("$outDir1\walking_$i.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save("$outDir2\walking_$i.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$img.Dispose()
Write-Output "Done - ${newW}x${newH}"
