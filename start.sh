#!/bin/bash

echo "🚀 Iniciando LB Creative Studio..."
echo ""

# Inicia Next.js em background
echo "📍 Iniciando localhost (Next.js dev)..."
npm run dev &
NEXT_PID=$!

# Inicia Telegram Scraper em background
echo "📍 Iniciando Telegram Scraper..."
cd telegram-scraper
npm run dev &
SCRAPER_PID=$!
cd ..

echo ""
echo "✅ Tudo rodando!"
echo "   Next.js: http://localhost:3000"
echo "   Scraper PID: $SCRAPER_PID"
echo ""
echo "Para parar, use: ./stop.sh"
echo ""

# Mantém script rodando
wait
