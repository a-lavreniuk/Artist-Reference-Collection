!include "FileFunc.nsh"
!insertmacro GetParameters
!insertmacro GetOptions

!macro customUnInstall
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--updated" $R1
  IfErrors 0 arcUninstallDone

  SetShellVarContext current

  InitPluginsDir
  File /oname=arc-uninstall-cleanup.ps1 "${BUILD_RESOURCES_DIR}\uninstall-cleanup.ps1"
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\arc-uninstall-cleanup.ps1"'
  Delete "$PLUGINSDIR\arc-uninstall-cleanup.ps1"

  RMDir /r "$APPDATA\ARC"
  RMDir /r "$APPDATA\artist-reference-collection"
  RMDir /r "$APPDATA\artist-reference-collection-dev"
  RMDir /r "$LOCALAPPDATA\ARC"
  RMDir /r "$LOCALAPPDATA\artist-reference-collection"
  RMDir /r "$LOCALAPPDATA\artist-reference-collection-dev"
  RMDir /r "$LOCALAPPDATA\artist-reference-collection-updater"
  RMDir /r "$LOCALAPPDATA\ARC-updater"
  RMDir /r "$TEMP\arc-screenshots"

  arcUninstallDone:
!macroend
