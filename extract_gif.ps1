Add-Type -AssemblyName System.Drawing
$gifPath = "c:\Users\Eysuu\Documents\Projects\SpiderwebWatchface\assets\bip-6\walking_guy.gif"
$outDir = "c:\Users\Eysuu\Documents\Projects\SpiderwebWatchface\assets\bip-6\walking_guy"

if (!(Test-Path -Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir
}

$img = [System.Drawing.Image]::FromFile($gifPath)
$fd = New-Object System.Drawing.Imaging.FrameDimension($img.FrameDimensionsList[0])
$frameCount = $img.GetFrameCount($fd)

for($i=0; $i -lt $frameCount; $i++) {
    $img.SelectActiveFrame($fd, $i)
    # Format the number as a 3-digit string so it's sorted automatically 001, 002... wait IMG_ANIM uses sequence numbers usually 1, 2, 3...
    # Let's save as walking_X.png, where X is 1, 2, 3...
    $frameNum = $i + 1
    $img.Save("$outDir\walking_$frameNum.png", [System.Drawing.Imaging.ImageFormat]::Png)
}

Write-Output "Extracted $frameCount frames to $outDir"
