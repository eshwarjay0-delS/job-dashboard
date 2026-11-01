# Fast, optional, read-only Windows UI Automation probe for Live Captions.
# Scoped to a WINDOW NAMED "Live captions"; never reads other applications.
# One process per enabled live Kompas session, no network calls or disk writes.
# Windows Live Captions may not publish its text via accessibility APIs.
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$target = $null
$last = ""
$discoverAt = [DateTime]::MinValue
while ($true) {
  try {
    if ($null -eq $target -or [DateTime]::UtcNow -ge $discoverAt) {
      $discoverAt = [DateTime]::UtcNow.AddSeconds(2)
      $target = $null
      # Root direct children = top-level windows only. Avoid UIA desktop-wide
      # descendant scans; never collect other applications' text.
      $wins = $root.FindAll(
        [System.Windows.Automation.TreeScope]::Children,
        [System.Windows.Automation.Condition]::TrueCondition
      )
      foreach ($w in $wins) {
        $title = [string]$w.Current.Name
        if ($title -match '^(?:Windows\s+)?Live[\s-]*Captions?(?:\b|[\s—-])') {
          $target = $w
          break
        }
      }
    }
    if ($null -ne $target) {
      $texts = New-Object 'System.Collections.Generic.List[string]'
      # TextPattern on the caption body is ideal. Some versions publish only
      # Name or Value on Text / Document nodes; use these as fallbacks.
      $items = $target.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition
      )
      $max = [Math]::Min($items.Count, 100)
      for ($i = 0; $i -lt $max; $i++) {
        $el = $items.Item($i)
        $kind = $el.Current.ControlType.ProgrammaticName
        if ($kind -notin @('ControlType.Text','ControlType.Document','ControlType.Edit')) { continue }
        $part = ""
        $pattern = $null
        if ($el.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$pattern)) {
          $part = [string]$pattern.DocumentRange.GetText(2000)
        }
        if ([string]::IsNullOrWhiteSpace($part)) {
          $pattern = $null
          if ($el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) {
            $part = [string]$pattern.Current.Value
          }
        }
        if ([string]::IsNullOrWhiteSpace($part)) { $part = [string]$el.Current.Name }
        $part = [regex]::Replace($part, '\s+', ' ').Trim()
        if ($part.Length -lt 4 -or $part.Length -gt 2000 -or
            $part -match '^(Live captions|Captions settings|Settings|Close|Minimize|Language|Microphone|Pause)$') { continue }
        if (-not $texts.Contains($part)) { $texts.Add($part) }
      }
      $text = [string]::Join(" ", $texts)
      if ($text.Length -gt 2500) { $text = $text.Substring($text.Length - 2500) }
      if (-not [string]::IsNullOrWhiteSpace($text) -and $text -ne $last) {
        $last = $text
        [Console]::Out.WriteLine((@{ source = 'windows-live-captions-uia'; text = $text } | ConvertTo-Json -Compress))
        [Console]::Out.Flush()
      }
    }
  } catch {
    $target = $null
  }
  Start-Sleep -Milliseconds 250
}
