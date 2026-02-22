Add-Type -AssemblyName System.Drawing
$outDir1 = "c:\Users\Eysuu\Documents\Projects\SpiderwebWatchface\assets\bip-6\walking_guy"
$outDir2 = "c:\Users\Eysuu\Documents\Projects\SpiderwebWatchface\assets\bip-6.r\walking_guy"

Remove-Item -Path "$outDir1\*.png" -Force
Remove-Item -Path "$outDir2\*.png" -Force

$gifPath = "c:\Users\Eysuu\Documents\Projects\SpiderwebWatchface\assets\bip-6\walking_guy.gif"
$img = [System.Drawing.Image]::FromFile($gifPath)
$fd = New-Object System.Drawing.Imaging.FrameDimension($img.FrameDimensionsList[0])
$frameCount = $img.GetFrameCount($fd)

for($i=0; $i -lt $frameCount; $i++) {
    $img.SelectActiveFrame($fd, $i)
    
    # Save 0-indexed format
    $img.Save("$outDir1\walking_$i.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Save("$outDir2\walking_$i.png", [System.Drawing.Imaging.ImageFormat]::Png)
}
Write-Output "Extracted frames to zero-based indexing"
