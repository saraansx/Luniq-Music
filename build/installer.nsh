; ============================================================
; Lune – Custom NSIS Installer Script
; ============================================================
; Flow: License → Install Location → Installing → Completing Lune Setup
;       (Run Lune ✓ + Create Desktop Shortcut □  →  Finish)
; ============================================================

!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

; ── Skip the "per-user vs all-users" page, force current user ──
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

; ── Everything below is install-only (skip during uninstaller build) ──
!ifndef BUILD_UNINSTALLER

Var CheckboxDesktop
Var CheckboxLaunch
Var CheckboxStartup
Var CheckDesktopState
Var CheckLaunchState
Var CheckStartupState

; Called by MUI to build the finish page UI
Function finPageCreate
  ; Rename the default "Next" button to "Finish"
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Finish"

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ; "Run Lune" checkbox – checked by default
  ${NSD_CreateCheckbox} 10u 10u 100% 15u "Run Lune"
  Pop $CheckboxLaunch
  ${NSD_SetState} $CheckboxLaunch ${BST_CHECKED}

  ; "Create Desktop Shortcut" checkbox – unchecked by default
  ${NSD_CreateCheckbox} 10u 35u 100% 15u "Create Desktop Shortcut"
  Pop $CheckboxDesktop
  ${NSD_SetState} $CheckboxDesktop ${BST_UNCHECKED}

  ; "Run on Startup" checkbox – unchecked by default
  ${NSD_CreateCheckbox} 10u 60u 100% 15u "Run on Startup"
  Pop $CheckboxStartup
  ${NSD_SetState} $CheckboxStartup ${BST_UNCHECKED}

  nsDialogs::Show
FunctionEnd

; Called when the user clicks Finish
Function finPageLeave
  ${NSD_GetState} $CheckboxDesktop $CheckDesktopState
  ${NSD_GetState} $CheckboxLaunch  $CheckLaunchState
  ${NSD_GetState} $CheckboxStartup $CheckStartupState

  ${If} $CheckDesktopState == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\Lune.lnk" "$INSTDIR\Lune.exe" "" "$INSTDIR\Lune.exe" 0
  ${EndIf}

  ${If} $CheckStartupState == ${BST_CHECKED}
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Lune" '"$INSTDIR\Lune.exe"'
  ${EndIf}

  ${If} $CheckLaunchState == ${BST_CHECKED}
    Exec '"$INSTDIR\Lune.exe"'
  ${EndIf}
FunctionEnd

; ── Replace the built-in finish page entirely ────────────────
; electron-builder checks !ifmacrodef customFinishPage at line 47
; of assistedInstaller.nsh – when defined, it replaces the default
; MUI finish page (with its HIDE_RUN_AFTER_FINISH logic) completely.
!macro customFinishPage
  Page custom finPageCreate finPageLeave
!macroend

!endif ; !BUILD_UNINSTALLER

; ── Uninstall Cleanup ────────────────────────────────────────
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Lune"
  Delete "$DESKTOP\Lune.lnk"
!macroend
