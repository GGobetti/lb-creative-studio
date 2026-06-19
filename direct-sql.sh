#!/bin/bash

# Read env file
export $(cat .env.local | grep -v '#' | xargs)

echo "🚀 Executando SQL diretamente via REST API..."

# Read the SQL files
AUDIT_SQL=$(cat supabase/migrations/20260617_games_audit_voting_system.sql | jq -Rs .)
LIMITS_SQL=$(cat supabase/migrations/20260617_games_daily_limits.sql | jq -Rs .)

echo "✅ Arquivos carregados"
echo "URL: $NEXT_PUBLIC_SUPABASE_URL"

# Try to execute via curl (direct SQL)
echo "Tentando executar migrations..."

# Method: Try the SQL endpoint if available
curl -s -X POST \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/sql" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"SELECT 1;\"}" | head -20

echo -e "\n✅ Conexão testada"
