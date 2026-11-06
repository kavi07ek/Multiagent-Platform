@echo off
:: AgentForge — Enable Local Wi-Fi Network Access
:: This script configures Windows Firewall and sets your Wi-Fi to Private
:: so other devices on the same Wi-Fi can connect to ports 3000 and 8000.

echo ========================================================
echo    AgentForge: Enabling Same Wi-Fi Access
echo ========================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script requires Administrator privileges.
    echo Please right-click 'allow-wifi-access.bat' and select 'Run as administrator'.
    echo.
    pause
    exit /b 1
)

echo [1/3] Setting Wi-Fi network profile to 'Private'...
powershell -NoProfile -Command "Get-NetConnectionProfile | Where-Object { $_.InterfaceAlias -like '*Wi-Fi*' -or $_.InterfaceAlias -like '*Wireless*' } | Set-NetConnectionProfile -NetworkCategory Private -ErrorAction SilentlyContinue"
echo    - Done.

echo [2/3] Adding Windows Firewall Inbound Rules for Ports 3000 and 8000...
netsh advfirewall firewall delete rule name="AgentForge Web (Port 3000)" >nul 2>&1
netsh advfirewall firewall add rule name="AgentForge Web (Port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1

netsh advfirewall firewall delete rule name="AgentForge API (Port 8000)" >nul 2>&1
netsh advfirewall firewall add rule name="AgentForge API (Port 8000)" dir=in action=allow protocol=TCP localport=8000 profile=any >nul 2>&1
echo    - Done.

echo [3/3] Retrieving your local Wi-Fi IP address...
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0 ^| findstr /v "0.0.0.0.*0.0.0.0.*"') do (
    set LOCAL_IP=%%a
)
echo.
echo ========================================================
echo    SUCCESS! Wi-Fi access is now enabled!
echo ========================================================
echo.
echo Open this URL on your phone or any device on the same Wi-Fi:
echo    http://10.54.25.52:3000
echo.
echo Press any key to exit.
pause >nul
