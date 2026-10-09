!macro customInstall
  FileOpen $0 "$INSTDIR\install-language.json" w
  ${If} $LANGUAGE == ${LANG_SPANISHINTERNATIONAL}
    FileWrite $0 '{"locale":"es"}'
  ${Else}
    FileWrite $0 '{"locale":"en"}'
  ${EndIf}
  FileClose $0
!macroend
