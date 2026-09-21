@echo off
setlocal EnableExtensions
chcp 65001 >nul

REM 始终以本 bat 所在目录为项目根（兼容中文路径，勿写死盘符路径）
cd /d "%~dp0"
if errorlevel 1 (
  echo [错误] 无法进入项目目录：
  echo %~dp0
  pause
  exit /b 1
)

set "PORT=5000"
echo ========================================
echo  ER-Think 开发启动
echo  目录: %CD%
echo  端口: %PORT%
echo ========================================
echo.

echo [1/3] 检查并释放端口 %PORT% ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p=%PORT%; $conns=Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if(-not $conns){ Write-Host ('      端口 {0} 空闲' -f $p); exit 0 }; $idList=@($conns | Select-Object -ExpandProperty OwningProcess -Unique); foreach($procId in $idList){ if($procId -and $procId -ne 0){ Write-Host ('      结束占用进程 PID={0}' -f $procId); Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } }; Start-Sleep -Seconds 1; Write-Host ('      端口 {0} 已处理' -f $p)"

if errorlevel 1 (
  echo       PowerShell 释放失败，尝试 netstat 兜底...
  for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr /I "LISTENING"') do (
    if not "%%P"=="0" (
      echo       taskkill PID=%%P
      taskkill /F /PID %%P >nul 2>&1
    )
  )
)
echo.

if not exist "package.json" (
  echo [错误] 当前目录找不到 package.json
  echo 请确认本文件位于「代码」项目根目录：%~dp0
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [2/3] 未检测到 node_modules，正在 npm install ...
  call npm.cmd install
  if errorlevel 1 (
    echo [错误] npm install 失败
    pause
    exit /b 1
  )
) else (
  echo [2/3] 依赖已存在，跳过 install
)
echo.

echo [3/3] 启动 Next.js：http://127.0.0.1:%PORT%
echo       按 Ctrl+C 可停止
echo.
call npm.cmd run dev

echo.
echo 服务已退出。
pause
endlocal
