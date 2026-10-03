<#
  แปลง .docx เป็น .pdf ด้วย Microsoft Word COM — ใช้เป็น fallback เมื่อไม่มี LibreOffice
  ฟอนต์ไทย (TH SarabunPSK) ต้องติดตั้งอยู่บนเครื่องที่รันตัวแปลง ไม่งั้น PDF จะใช้ฟอนต์แทน
#>
param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out
)

$ErrorActionPreference = 'Stop'
$wdExportFormatPDF = 17
$wdDoNotSaveChanges = 0

$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  # ReadOnly + AddToRecentFiles=false กันไม่ให้ Word แก้ไฟล์ต้นทางหรือจำไว้ใน recent list
  $doc = $word.Documents.Open($In, $false, $true, $false)
  $doc.ExportAsFixedFormat($Out, $wdExportFormatPDF)
}
finally {
  if ($doc) { try { $doc.Close($wdDoNotSaveChanges) } catch {} }
  if ($word) { try { $word.Quit() } catch {} }
  # ไม่ release COM แล้ว WINWORD.EXE จะค้างอยู่เป็น process ผี
  if ($doc) { try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($doc) } catch {} }
  if ($word) { try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) } catch {} }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
