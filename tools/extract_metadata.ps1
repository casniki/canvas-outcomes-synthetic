<#
.SYNOPSIS
  Extract institutional metadata (no student, enrollment, course-name, instructor
  or result rows) from the production canvas-outcomes model open in Power BI
  Desktop, for tools/make_synthetic.py.

.DESCRIPTION
  Runs a fixed set of DAX queries against the local Desktop model and writes
  metadata/*.csv. It reads only:
    - Course: School, Department, Account Name, Account Path (distinct)
    - Learning Outcome: title, type, context, calculation method, group, Program,
      Program Source, and the owning course's account (never its name/code/ID)
    - Learning Outcome Group: names and paths of groups that hold outcomes
    - Program Code Map
  Canvas IDs are replaced in memory by sequence numbers before anything is
  written. In course-context groups the root group is the course name; it is
  written as {COURSE}. Course codes/CRNs inside group names and titles are
  scrubbed. Course Outcome titles (free text written per course) are not
  extracted; the generator replaces them.

  Requires Windows PowerShell 5.1 (the ADOMD client from SSMS is .NET Framework).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\extract_metadata.ps1 -Port 49679
#>
param(
  [Parameter(Mandatory = $true)][int]$Port,
  [string]$OutDir = '',
  [string]$AdomdDll = ''
)
$ErrorActionPreference = 'Stop'
if (-not $OutDir) { $OutDir = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\metadata' }

if (-not $AdomdDll) {
  $AdomdDll = Get-ChildItem 'C:\Program Files\Microsoft SQL Server Management Studio *\Release\Common7\IDE\Microsoft.AnalysisServices.AdomdClient.dll' |
    Select-Object -First 1 -ExpandProperty FullName
}
try { [void][Reflection.Assembly]::LoadFrom($AdomdDll) } catch { }

$conn = New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection "Data Source=localhost:$Port"
$conn.Open()

function Invoke-Dax([string]$query) {
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = $query
  $reader = $cmd.ExecuteReader()
  $rows = New-Object System.Collections.Generic.List[object]
  while ($reader.Read()) {
    $h = [ordered]@{}
    for ($i = 0; $i -lt $reader.FieldCount; $i++) {
      $name = $reader.GetName($i) -replace '^.*\[(.*)\]$', '$1'
      $v = $reader.GetValue($i)
      if ($v -is [DBNull]) { $v = $null }
      $h[$name] = $v
    }
    $rows.Add([pscustomobject]$h)
  }
  $reader.Close()
  return $rows
}

# Scrub course codes and CRNs that faculty sometimes put in group names or titles.
function Clean([string]$s) {
  if ($null -eq $s) { return $null }
  $s = $s -replace '\b[A-Z]{2,5} ?\d{3}[A-Z]?_\d{3,6}\b', '[course]'   # ABCD123_45678
  $s = $s -replace '\s*\(\d{5}\)', ''                                  # (45678)
  $s = $s -replace '\b[A-Z]{2,5}_\d{3}[A-Z]?_\d{4,6}\b', '[course]'
  return $s.Trim()
}

# Subgroups inside a course are named by faculty; a name carrying a course code
# (e.g. 'ABCD 123 ...', 'WXYZ456', '<instructor> - EFGH 789 ...') is replaced whole.
function CleanCourseSegment([string]$s) {
  if ($null -eq $s) { return $null }
  if ($s -cmatch '\b[A-Z]{3,5} ?\d{3}[A-Z]?\b') { return 'Course outcome group' }
  return (Clean $s)
}

New-Item -ItemType Directory -Force $OutDir | Out-Null

# ---- accounts ------------------------------------------------------------
$orgs = Invoke-Dax @"
EVALUATE SUMMARIZE ( 'Course', 'Course'[School], 'Course'[Department], 'Course'[Account Name], 'Course'[Account Path] )
"@
$orgs | Select-Object @{n='school';e={$_.School}}, @{n='department';e={$_.Department}},
  @{n='account_name';e={$_.'Account Name'}}, @{n='account_path';e={$_.'Account Path'}} |
  Export-Csv (Join-Path $OutDir 'orgs.csv') -NoTypeInformation -Encoding UTF8

# ---- outcomes --------------------------------------------------------------
$outcomes = Invoke-Dax @"
EVALUATE
SELECTCOLUMNS (
  'Learning Outcome',
  "id", 'Learning Outcome'[Learning Outcome ID],
  "type", 'Learning Outcome'[Outcome Type],
  "title", IF ( 'Learning Outcome'[Outcome Type] = "Course Outcome", BLANK (), 'Learning Outcome'[Outcome Title] ),
  "context", 'Learning Outcome'[Outcome Context Type],
  "calc_method", 'Learning Outcome'[Calculation Method],
  "calc_value", 'Learning Outcome'[Calculation Value],
  "group_id", 'Learning Outcome'[Learning Outcome Group ID],
  "program", 'Learning Outcome'[Program],
  "program_source", 'Learning Outcome'[Program Source],
  "owner_id", 'Learning Outcome'[Owning Course ID],
  "owner_school", LOOKUPVALUE ( 'Course'[School], 'Course'[Course ID], 'Learning Outcome'[Owning Course ID] ),
  "owner_department", LOOKUPVALUE ( 'Course'[Department], 'Course'[Course ID], 'Learning Outcome'[Owning Course ID] ),
  "owner_account_name", LOOKUPVALUE ( 'Course'[Account Name], 'Course'[Course ID], 'Learning Outcome'[Owning Course ID] ),
  "owner_account_path", LOOKUPVALUE ( 'Course'[Account Path], 'Course'[Course ID], 'Learning Outcome'[Owning Course ID] )
)
"@

# ---- groups that hold outcomes ---------------------------------------------
$groups = Invoke-Dax @"
EVALUATE
SELECTCOLUMNS (
  FILTER ( 'Learning Outcome Group', 'Learning Outcome Group'[Learning Outcome Group ID] IN VALUES ( 'Learning Outcome'[Learning Outcome Group ID] ) ),
  "id", 'Learning Outcome Group'[Learning Outcome Group ID],
  "name", 'Learning Outcome Group'[Group Name],
  "parent", 'Learning Outcome Group'[Parent Group Name],
  "root", 'Learning Outcome Group'[Root Group Name],
  "path", 'Learning Outcome Group'[Group Path],
  "depth", 'Learning Outcome Group'[Group Depth],
  "context", 'Learning Outcome Group'[Group Context Type],
  "truncated", 'Learning Outcome Group'[Path Truncated]
)
"@

# Sequence numbers replace Canvas IDs (sorted, so reruns are stable).
$gKey = @{}; $i = 0
foreach ($g in ($groups | Sort-Object id)) { $i++; $gKey[[string]$g.id] = $i }
$cKey = @{}; $i = 0
foreach ($c in ($outcomes | Where-Object { $_.owner_id -ne $null } | Select-Object -ExpandProperty owner_id -Unique | Sort-Object)) { $i++; $cKey[[string]$c] = $i }

# Which course owns each course-context group (from its outcomes).
$groupOwner = @{}
foreach ($o in $outcomes) {
  if ($o.owner_id -ne $null -and $o.group_id -ne $null -and -not $groupOwner.ContainsKey([string]$o.group_id)) {
    $groupOwner[[string]$o.group_id] = $cKey[[string]$o.owner_id]
  }
}

$groups | Sort-Object id | ForEach-Object {
  $isCourse = $_.context -eq 'Course'
  $root = [string]$_.root
  $path = [string]$_.path
  if ($isCourse) {
    $rest = if ($root -and $path.StartsWith($root + ' > ')) { $path.Substring($root.Length + 3) -split ' > ' } else { @() }
    $path = (@('{COURSE}') + @($rest | ForEach-Object { CleanCourseSegment $_ })) -join ' > '
    $name = if ($_.depth -eq 1) { '{COURSE}' } else { CleanCourseSegment $_.name }
    $parent = if ($_.depth -eq 2) { '{COURSE}' } else { CleanCourseSegment $_.parent }
    $root = '{COURSE}'
  } else {
    $name = Clean $_.name; $parent = Clean $_.parent
  }
  [pscustomobject]@{
    group_key = $gKey[[string]$_.id]
    name = $name
    parent = $parent
    root = $root
    path = (Clean $path)
    depth = $_.depth
    context = $_.context
    truncated = $_.truncated
    owner_key = $groupOwner[[string]$_.id]
  }
} | Export-Csv (Join-Path $OutDir 'groups.csv') -NoTypeInformation -Encoding UTF8

$n = 0
$outcomes | Sort-Object id | ForEach-Object {
  $n++
  [pscustomobject]@{
    outcome_key = $n
    type = $_.type
    title = (Clean $_.title)
    context = $_.context
    calc_method = $_.calc_method
    calc_value = $_.calc_value
    group_key = if ($_.group_id -ne $null) { $gKey[[string]$_.group_id] } else { $null }
    program = $_.program
    program_source = $_.program_source
    owner_key = if ($_.owner_id -ne $null) { $cKey[[string]$_.owner_id] } else { $null }
    owner_school = $_.owner_school
    owner_department = $_.owner_department
    owner_account_name = $_.owner_account_name
    owner_account_path = $_.owner_account_path
  }
} | Export-Csv (Join-Path $OutDir 'outcomes.csv') -NoTypeInformation -Encoding UTF8

# ---- Program Code Map ------------------------------------------------------
Invoke-Dax "EVALUATE 'Program Code Map'" |
  Select-Object @{n='program_code';e={$_.'Program Code'}}, @{n='code_type';e={$_.'Code Type'}}, @{n='program';e={$_.Program}} |
  Export-Csv (Join-Path $OutDir 'program_code_map.csv') -NoTypeInformation -Encoding UTF8

$conn.Close()
Write-Host ("orgs={0} outcomes={1} groups={2}" -f $orgs.Count, $outcomes.Count, $groups.Count)
