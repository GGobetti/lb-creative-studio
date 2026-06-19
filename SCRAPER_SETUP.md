# Configuração e Gerenciamento do Telegram Scraper

## Resumo Rápido

O scraper agora é gerenciado pelo **PM2** (Process Manager 2), um gerenciador de processos Node.js que reinicia automaticamente se o processo cair.

---

## ✅ Instalação Inicial (já feito)

PM2 foi instalado globalmente:
```bash
npm install -g pm2
```

O scraper está configurado em `ecosystem.config.js`.

---

## 🚀 Como Iniciar

```bash
./start.sh
```

Isso vai:
1. Criar a pasta `logs/` se não existir
2. Subir o scraper via PM2 (gerenciado automaticamente)
3. Subir o Next.js dev em background (para testes locais)

---

## 🛑 Como Parar

```bash
./stop.sh
```

Isso vai:
1. Parar o scraper (via PM2)
2. Parar o Next.js dev

---

## 📊 Verificar Status

### Ver se está rodando agora
```bash
pm2 status
```

Saída esperada:
```
┌────┬───────────────┬───────┬────────┬───────────┐
│ id │ name          │ pid   │ status │ uptime    │
├────┼───────────────┼───────┼────────┼───────────┤
│ 0  │ lb-scraper    │ xxxxx │ online │ 2h 30m    │
└────┴───────────────┴───────┴────────┴───────────┘
```

Coluna **status** = `online` → tudo bem  
Coluna **↺** = número de restarts (se mudar frequentemente, há problema)

---

## 📋 Ver Logs

### Logs em tempo real
```bash
pm2 logs lb-scraper
```

Sai pressionando `CTRL+C`.

### Últimas 50 linhas (sem ficar aguardando)
```bash
pm2 logs lb-scraper --lines 50 --nostream
```

### Logs salvos no disco
- Saída normal: `logs/scraper-out.log`
- Erros: `logs/scraper-error.log`

---

## 🔄 Reiniciar Manualmente

Se precisar reiniciar o scraper por algum motivo:
```bash
pm2 restart lb-scraper
```

O scraper vai desligar, esperar 5 segundos, e subir de novo.

---

## ⚙️ O que PM2 Faz Automaticamente

- **Monitoramento**: Detecta se o processo morreu/travou
- **Reinício**: Reinicia até 10 vezes em caso de crash (evita loop infinito)
- **Logs persistentes**: Salva tudo em `logs/scraper-out.log` e `logs/scraper-error.log`
- **Controle**: Permite parar, reiniciar e ver status sem matar terminal

---

## 🔧 Timeouts de Proteção (adicionados no código)

O scraper agora tem proteção contra travamentos:

| Operação | Timeout | O que faz |
|----------|---------|----------|
| Tarefa na fila | 10 min | Se uma tarefa não termina em 10 min, aborta |
| Download de foto | 30s | Se a foto não baixa em 30s, pula |
| Envio para Vault | 25 min | Se o upload travar, aborta e tenta de novo |
| Busca de mensagem | 30s | Se Telegram não responde, tenta de novo |
| Health check | 15s | Detecta se a conexão morreu |

Se qualquer um desses timeouts for acionado, PM2 vai reiniciar o processo.

---

## 💾 Cache de Fotos Entre Restarts

Quando o scraper reinicia, ele carrega o cache de hashes de fotos do disco (`logs/.temp/photo_hash_cache.json`). Isso significa:

- ✅ A limitação de dedup cross-file **sobrevive a restarts**
- ✅ Fotos que já foram vistas em outro arquivo não vão ser re-adicionadas
- ✅ O cache é salvo a cada 10 minutos automaticamente

---

## 📱 Opcional: Sobreviver a Reboot do Servidor

Se o Mac reiniciar, o scraper não sobe sozinho por padrão. Para fazer isso:

```bash
pm2 startup
```

Isso vai exibir um comando — copie e execute esse comando no terminal (PM2 vai pedir sudo).

Depois:
```bash
pm2 save
```

Agora, se o Mac reiniciar, o scraper sobe automaticamente sem você fazer nada.

**Para desfazer isso:**
```bash
pm2 unstartup
```

---

## 🌐 Localhost está OFF? É Normal

**Situação:** Você fecha o terminal e depois vê que `localhost:3000` não responde.

**Por quê:** Quando fecha o `./start.sh`, o Next.js dev também cai (é esperado). MAS o **scraper continua rodando via PM2** em background.

### Para acessar localhost:3000 de novo:

**Opção 1** (Recomendado — tudo junto):
```bash
./start.sh
```

Sobe scraper + Next.js. Acessa `localhost:3000` no navegador. Quando fechar o terminal:
- Scraper: continua rodando (PM2)
- Next.js: cai (normal)

**Opção 2** (Só Next.js, scraper já rodando):
```bash
npm run dev
```

Na pasta raiz. Sobe só o Next.js. Scraper já está lá via PM2.

### Verificar se o scraper está rodando:
```bash
pm2 status
```

Se aparecer `online` na coluna **status**, o scraper está funcionando mesmo que localhost esteja off.

---

## 🆘 Troubleshooting

### "Scraper está reiniciando toda hora"
```bash
pm2 logs lb-scraper --lines 100
```
Veja a última linha de erro. Pode ser problema de conexão Telegram ou variável de env faltando.

### "PM2 não encontra o processo"
```bash
pm2 list
```
Se não aparecer nada, execute `./start.sh` de novo.

### "Quero ver TUDO em tempo real"
```bash
pm2 monit
```
Dashboard visual que atualiza em tempo real. Sai com `q`.

### "Preciso matar o PM2 todo"
```bash
pm2 kill
```
Isso mata o daemon do PM2. Na próxima vez que rodar um comando PM2, ele reinicia sozinho.

---

## 📝 Resumo dos Arquivos Modificados

| Arquivo | O que foi feito |
|---------|-----------------|
| `ecosystem.config.js` | Configuração do PM2 (novo) |
| `start.sh` | Agora sobe PM2 + Next.js (modificado) |
| `stop.sh` | Agora para via PM2 (modificado) |
| `telegram-scraper/src/index.ts` | Timeouts + cache persistente (modificado) |
| `.gitignore` | Adicionado `logs/` (modificado) |

---

## 🎯 Fluxo do Dia a Dia

```
Dia 1:
  ./start.sh              ← scraper sobe, PM2 monitora

Scraper trava sozinho?
  → PM2 reinicia em 5s, você não precisa fazer nada

Você quer parar tudo:
  ./stop.sh

Você quer ver logs:
  pm2 logs lb-scraper

Você quer reiniciar manualmente:
  pm2 restart lb-scraper

Servidor reinicia?
  → Se rodou `pm2 startup` antes, sobe sozinho
  → Se não rodou, execute `./start.sh` uma vez
```

---

**Perguntas?** Todos os comandos acima funcionam. PM2 é super robusto e não quebra nada.
