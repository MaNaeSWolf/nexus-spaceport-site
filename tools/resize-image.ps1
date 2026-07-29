# Resize and re-encode a news image.
#   powershell -File tools/resize-image.ps1 -Source <in> -Dest <out.jpg> [-MaxWidth 1600] [-Quality 82]
#
# Uses System.Drawing, which ships with Windows, so there is no install step.
# Photographs and renders go to JPEG; a source with transparency would lose it,
# which is why the script warns rather than silently flattening.
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Dest,
  [int]$MaxWidth = 1600,
  [int]$Quality = 82
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path -LiteralPath $Source)) { Write-Error "Source not found: $Source"; exit 1 }
$img = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Source))
try {
  if ([System.Drawing.Image]::IsAlphaPixelFormat($img.PixelFormat)) {
    Write-Output "NOTE: source has transparency; JPEG will flatten it onto white."
  }
  $w = $img.Width; $h = $img.Height
  if ($w -gt $MaxWidth) { $h = [int]([math]::Round($h * ($MaxWidth / $w))); $w = $MaxWidth }

  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.DrawImage($img, 0, 0, $w, $h)

  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]$Quality)

  $dir = Split-Path -Parent $Dest
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $bmp.Save($Dest, $codec, $ep)

  $before = (Get-Item -LiteralPath $Source).Length
  $after = (Get-Item -LiteralPath $Dest).Length
  Write-Output ("OK {0}x{1}  {2:N0} KB -> {3:N0} KB" -f $w, $h, ($before / 1KB), ($after / 1KB))
}
finally {
  if ($g) { $g.Dispose() }
  if ($bmp) { $bmp.Dispose() }
  $img.Dispose()
}
