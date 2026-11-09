@echo off
rem Prueba Cuadrao en el celular conectado por USB (doble clic)
cd /d "%~dp0"

set ADB=adb
where adb >nul 2>nul || set ADB="%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

echo === Compilando Cuadrao ===
call npm run build || goto error

echo === Conectando el celular (puerto 5180) ===
%ADB% reverse tcp:5180 tcp:5180 || goto error

echo === Arrancando el servidor ===
start "Cuadrao servidor" cmd /k npm run serve

echo.
echo Listo: abre http://localhost:5180 en Chrome del celular.
echo Para apagar, cierra la ventana "Cuadrao servidor".
pause
exit /b 0

:error
echo.
echo Algo fallo. Revisa que el celular este conectado con depuracion USB activa.
pause
exit /b 1
