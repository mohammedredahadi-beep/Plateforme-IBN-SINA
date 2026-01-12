@echo off
echo ==========================================
echo    DEMARRAGE DU SERVEUR IBN SINA IA
echo ==========================================
echo.
echo 1. Installation des dependances...
python -m pip install --upgrade pip
echo Nettoyage des anciennes versions...
python -m pip uninstall -y langchain langchain-community langchain-core langchain-google-genai
echo Installation propre...
python -m pip install -r requirements.txt
echo.
echo 2. Demarrage du serveur...
python server.py
echo.
pause
