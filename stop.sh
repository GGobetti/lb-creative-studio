#!/bin/bash

echo "🛑 Parando todos os serviços..."
echo ""

# Para Next.js dev
echo "⏹️  Parando Next.js..."
pkill -f "next dev"

# Para Telegram Scraper
echo "⏹️  Parando Telegram Scraper..."
pkill -f "ts-node.*telegram-scraper"
pkill -f "node.*telegram-scraper"

echo ""
echo "✅ Todos os serviços foram parados"
echo ""
