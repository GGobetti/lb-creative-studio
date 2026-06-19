#!/bin/bash

echo "Parando todos os servicos..."
echo ""

# Para o scraper via PM2
if command -v pm2 &> /dev/null; then
  echo "Parando Telegram Scraper (PM2)..."
  pm2 stop lb-scraper 2>/dev/null || true
  pm2 delete lb-scraper 2>/dev/null || true
fi

# Para Next.js dev
echo "Parando Next.js..."
pkill -f "next dev" 2>/dev/null || true

echo ""
echo "Todos os servicos foram parados."
echo ""
