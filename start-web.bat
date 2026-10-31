@echo off
cd /d "%~dp0"
set PATH=%PATH%;C:\Program Files\nodejs
npx expo start --web --port 8082
