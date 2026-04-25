#!/bin/bash
set -e

WORKSPACE=".."
LUBAN_DLL="${WORKSPACE}/Tools/Luban/Luban.dll"
CONF_ROOT="."

if [ ! -f "$LUBAN_DLL" ]; then
    echo "[ERROR] Luban.dll not found at: $LUBAN_DLL"
    echo "Please download Luban from https://github.com/focus-creative-games/luban/releases"
    echo "and extract to Tools/Luban/ directory."
    exit 1
fi

dotnet "$LUBAN_DLL" \
    -t client \
    -c typescript-bin \
    -d bin \
    --conf "${CONF_ROOT}/luban.conf" \
    -x outputCodeDir="${WORKSPACE}/assets/Scripts/Data/schema" \
    -x outputDataDir="${WORKSPACE}/assets/resources/LubanData" \
    -x bin.fileExt=bin

echo "[OK] Luban code and data generated successfully."
