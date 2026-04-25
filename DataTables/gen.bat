@echo off
setlocal

set WORKSPACE=..
set LUBAN_DLL=%WORKSPACE%\Tools\Luban\Luban.dll
set CONF_ROOT=.

if not exist "%LUBAN_DLL%" (
    echo [ERROR] Luban.dll not found at: %LUBAN_DLL%
    echo Please download Luban from https://github.com/focus-creative-games/luban/releases
    echo and extract to Tools/Luban/ directory.
    pause
    exit /b 1
)

dotnet %LUBAN_DLL% ^
    -t client ^
    -c typescript-bin ^
    -d bin ^
    --conf %CONF_ROOT%\luban.conf ^
    -x outputCodeDir=%WORKSPACE%\assets\Scripts\Data\schema ^
    -x outputDataDir=%WORKSPACE%\assets\resources\LubanData ^
    -x bin.fileExt=bin

if %ERRORLEVEL% EQU 0 (
    echo [OK] Luban code and data generated successfully.
) else (
    echo [ERROR] Luban generation failed.
)

pause
