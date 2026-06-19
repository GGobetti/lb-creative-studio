#!/bin/bash

echo "Iniciando LB Creative Studio..."
echo ""

# Garante que a pasta de logs existe
mkdir -p logs

# Verifica se PM2 está instalado
if ! command -v pm2 &> /dev/null; then
  echo "PM2 não encontrado. Instalando globalmente..."
  npm install -g pm2
fi

# Verifica se o scraper já está rodando
if pm2 list 2>/dev/null | grep -q "lb-scraper"; then
  echo "Telegram Scraper já está rodando via PM2. Reiniciando..."
  pm2 restart lb-scraper
else
  echo "Iniciando Telegram Scraper via PM2..."
  pm2 start ecosystem.config.js --only lb-scraper
fi

# Inicia Next.js em background normal (ambiente de dev local)
echo "Iniciando Next.js dev..."
npm run dev &
NEXT_PID=$!

echo ""
echo "Tudo rodando!"
echo "  Next.js:  http://localhost:3000"
echo "  Scraper:  gerenciado pelo PM2 (reinicia automaticamente)"
echo ""
echo "Comandos uteis:"
echo "  pm2 status          -> ver se o scraper esta rodando"
echo "  pm2 logs lb-scraper -> ver logs em tempo real"
echo "  pm2 restart lb-scraper -> reiniciar manualmente"
echo "  ./stop.sh           -> parar tudo"
echo ""

# Mantém o terminal preso no Next.js
wait $NEXT_PID
