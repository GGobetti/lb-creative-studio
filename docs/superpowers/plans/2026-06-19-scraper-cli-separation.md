# Separação Scraper CLI vs App Web — Plano de Implementação

> **Para agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task-by-task. Passos usam syntax checkbox (`- [ ]`) para rastreamento.

**Objetivo:** Refatorar o scraper Telegram de um background service que escuta continuamente para um CLI sob demanda que você roda quando quer, separando completamente da aplicação web que roda no Vercel.

**Arquitetura:** O scraper passa de um Express server que roda 24/7 escutando eventos para um script Node.js/CLI que você executa manualmente (ou via cron) na sua máquina. A app web (Vercel) fica completamente independente — só consome dados do Vault (seu grupo Telegram privado). A única ponte é o Supabase como "log compartilhado" de status.

**Tech Stack:** Node.js CLI (yargs ou Commander.js), Telegram client (gramjs/telegram), Supabase (leitura apenas de status), sem Express.

---

## Global Constraints

- Não mexer em banco de dados, tabelas, ou migrations
- Não mexer em integrations externas (Google OAuth, Stripe, Supabase auth)
- Não mexer na app web (Vercel) por enquanto
- Scraper continua usando mesmas credenciais Telegram (TELEGRAM_SESSION, API_ID, API_HASH)
- Vault continua sendo o grupo privado de origem dos arquivos

---

## Estrutura de Arquivos

```
telegram-scraper/                      (diretório separado)
├── src/
│   ├── index.ts                        (novo: entry point CLI com yargs)
│   ├── commands/
│   │   ├── scan.ts                     (novo: comando principal "scan")
│   │   └── status.ts                   (novo: comando para ver status de jobs)
│   ├── scraper/
│   │   ├── core.ts                     (refatorado: lógica de processamento)
│   │   ├── photo-processing.ts         (refatorado: dedup/hash de fotos)
│   │   └── types.ts                    (novo: tipos compartilhados)
│   ├── telegram/
│   │   ├── client.ts                   (novo: wrapper do Telegram client)
│   │   └── vault.ts                    (novo: operações de Vault)
│   └── config.ts                       (novo: carrega .env)
├── .env.example                        (criado: template de variáveis)
├── package.json                        (modificado: remove Express, add yargs)
└── tsconfig.json                       (sem mudanças)
```

---

## Task 1: Setup e Configuração da CLI

**Arquivos:**
- Modificar: `telegram-scraper/package.json` (remove Express, add yargs/Commander)
- Criar: `telegram-scraper/src/config.ts`
- Criar: `telegram-scraper/.env.example`

**Interfaces:**
- Produz: Configuração centralizada com validação de env vars

- [ ] **Passo 1: Remover dependências Express do package.json**

Abra `telegram-scraper/package.json` e modifique `dependencies`:

```json
{
  "name": "lb-telegram-scraper",
  "version": "1.0.0",
  "description": "Telegram scraper CLI para LB Creative Studio",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "scan": "node dist/index.js scan",
    "status": "node dist/index.js status"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "dotenv": "^16.3.1",
    "jimp": "^0.22.10",
    "telegram": "^2.19.10",
    "yargs": "^17.7.2"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/yargs": "^17.0.24",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Passo 2: Criar config.ts com validação**

Crie `telegram-scraper/src/config.ts`:

```typescript
import dotenv from "dotenv";

dotenv.config();

interface Config {
  telegram: {
    apiId: number;
    apiHash: string;
    session: string;
    vaultChannelId: string;
  };
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
}

export function loadConfig(): Config {
  const missing: string[] = [];

  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const session = process.env.TELEGRAM_SESSION;
  const vaultId = process.env.TELEGRAM_VAULT_CHANNEL_ID;
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiId) missing.push("TELEGRAM_API_ID");
  if (!apiHash) missing.push("TELEGRAM_API_HASH");
  if (!session) missing.push("TELEGRAM_SESSION");
  if (!vaultId) missing.push("TELEGRAM_VAULT_CHANNEL_ID");
  if (!sbUrl) missing.push("SUPABASE_URL");
  if (!sbKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    console.error(`❌ Variáveis de ambiente faltando: ${missing.join(", ")}`);
    process.exit(1);
  }

  return {
    telegram: {
      apiId: parseInt(apiId!, 10),
      apiHash: apiHash!,
      session: session!,
      vaultChannelId: vaultId!,
    },
    supabase: {
      url: sbUrl!,
      serviceRoleKey: sbKey!,
    },
  };
}
```

- [ ] **Passo 3: Criar .env.example**

Crie `telegram-scraper/.env.example`:

```
# Telegram
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_SESSION=
TELEGRAM_VAULT_CHANNEL_ID=

# Supabase
SUPABASE_URL=https://yruoiwtnxopcbiiuvxxa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Passo 4: Rodar instalação de dependências**

```bash
cd telegram-scraper
npm install
```

Esperado: Sem erros, `node_modules` atualizado.

- [ ] **Passo 5: Commit**

```bash
cd telegram-scraper
git add package.json package-lock.json src/config.ts .env.example
git commit -m "chore(scraper): setup CLI base — remove Express, add yargs e config validation"
```

---

## Task 2: Criar Wrapper do Telegram Client

**Arquivos:**
- Criar: `telegram-scraper/src/telegram/client.ts`
- Criar: `telegram-scraper/src/telegram/vault.ts`

**Interfaces:**
- Consome: `loadConfig()` do task anterior
- Produz: `TelegramClient` (wrapper), `VaultUploader` (interface para upload)

- [ ] **Passo 1: Criar wrapper TelegramClient**

Crie `telegram-scraper/src/telegram/client.ts`:

```typescript
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

interface ClientConfig {
  apiId: number;
  apiHash: string;
  session: string;
}

export async function initTelegramClient(config: ClientConfig): Promise<TelegramClient> {
  const stringSession = new StringSession(config.session);

  const client = new TelegramClient(stringSession, config.apiId, config.apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.connect();
    const me = await client.getMe();
    console.log(`✅ Conectado como: ${me.firstName || "Usuário"}`);
    return client;
  } catch (err: any) {
    console.error(`❌ Falha ao conectar ao Telegram: ${err.message}`);
    throw err;
  }
}

export async function disconnectClient(client: TelegramClient): Promise<void> {
  try {
    await client.disconnect();
    console.log("✅ Desconectado do Telegram");
  } catch (err: any) {
    console.warn(`⚠️ Erro ao desconectar: ${err.message}`);
  }
}
```

- [ ] **Passo 2: Criar interface de operações de Vault**

Crie `telegram-scraper/src/telegram/vault.ts`:

```typescript
import { TelegramClient } from "telegram";
import { CustomFile } from "telegram/client/uploads";

export interface VaultUploadOptions {
  fileName: string;
  fileSize: number;
  caption: string;
  filePath: string;
}

export class VaultUploader {
  constructor(private client: TelegramClient, private vaultChannelId: string) {}

  async upload(options: VaultUploadOptions): Promise<number> {
    try {
      const vaultEntity = await this.client.getEntity(this.vaultChannelId);
      const customFile = new CustomFile(options.fileName, options.fileSize, options.filePath);

      const sentMessage = await this.client.sendFile(vaultEntity, {
        file: customFile,
        caption: options.caption,
      });

      return sentMessage.id;
    } catch (err: any) {
      throw new Error(`Falha ao fazer upload para Vault: ${err.message}`);
    }
  }

  async getVaultMessages(limit: number = 100): Promise<any[]> {
    try {
      return await this.client.getMessages(this.vaultChannelId, { limit });
    } catch (err: any) {
      throw new Error(`Falha ao buscar mensagens do Vault: ${err.message}`);
    }
  }
}
```

- [ ] **Passo 3: Commit**

```bash
cd telegram-scraper
git add src/telegram/client.ts src/telegram/vault.ts
git commit -m "feat(scraper): add Telegram client wrapper e vault uploader"
```

---

## Task 3: Extrair Lógica de Foto Processing (Photo Hash/Dedup)

**Arquivos:**
- Criar: `telegram-scraper/src/scraper/types.ts`
- Criar: `telegram-scraper/src/scraper/photo-processing.ts`
- Modificar: `telegram-scraper/src/imageHash.ts` (mover do raiz pra cá)

**Interfaces:**
- Consome: Nada novo
- Produz: `PhotoDeduplicator` class, tipos de cache

- [ ] **Passo 1: Criar tipos compartilhados**

Crie `telegram-scraper/src/scraper/types.ts`:

```typescript
export interface BufferedMessage {
  message: any;
  type: "document" | "photo";
}

export interface ChatBuffer {
  chatId: string;
  chatTitle: string;
  senderId?: string;
  messages: BufferedMessage[];
  timeoutId: NodeJS.Timeout;
}

export interface ScraperJob {
  fileName: string;
  fileSize: number;
  chatTitle: string;
  photos: string[];
  printerType: string;
}
```

- [ ] **Passo 2: Criar PhotoDeduplicator**

Crie `telegram-scraper/src/scraper/photo-processing.ts`:

```typescript
import fs from "fs";
import path from "path";
import { getPerceptualHash, hammingDistance } from "./imageHash";

interface HashCache {
  [hash: string]: string;
}

export class PhotoDeduplicator {
  private globalPhotoHashCache: Map<string, string> = new Map();
  private entityPhotoHashCache: Map<string, Set<string>> = new Map();
  private cacheFile: string;

  constructor(cacheFilePath: string) {
    this.cacheFile = cacheFilePath;
    this.loadCache();
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, "utf-8")) as HashCache;
        for (const [hash, entityId] of Object.entries(data)) {
          this.globalPhotoHashCache.set(hash, entityId);
        }
        console.log(`[Cache] ${this.globalPhotoHashCache.size} photo hashes carregados`);
      }
    } catch (err: any) {
      console.warn(`[Cache] Falha ao carregar cache: ${err.message}`);
    }
  }

  saveCache(): void {
    try {
      const dir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data: HashCache = {};
      for (const [hash, entityId] of this.globalPhotoHashCache) {
        data[hash] = entityId;
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(data));
      console.log(`[Cache] ${this.globalPhotoHashCache.size} hashes salvos`);
    } catch (err: any) {
      console.warn(`[Cache] Falha ao salvar cache: ${err.message}`);
    }
  }

  async deduplicatePhotos(
    candidateUrls: string[],
    existingHashSet: Set<string>,
    bannedHashes: string[],
    entityId: string
  ): Promise<string[]> {
    const result: string[] = [];

    for (const url of candidateUrls) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) {
          result.push(url);
          continue;
        }

        const tempPath = path.join("/tmp", `photo_${Date.now()}_${Math.random()}.jpg`);
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(tempPath, buffer);

        const hash = await getPerceptualHash(tempPath);

        // Check blacklist
        const isBanned = bannedHashes.some((b) => hammingDistance(hash, b) <= 10);
        if (isBanned) {
          console.log(`[Dedup] Foto bloqueada (propaganda)`);
          fs.unlinkSync(tempPath);
          continue;
        }

        // Check same-file duplication
        let isDupSameFile = false;
        for (const h of existingHashSet) {
          if (hammingDistance(hash, h) <= 10) {
            isDupSameFile = true;
            break;
          }
        }
        if (isDupSameFile) {
          console.log(`[Dedup] Foto duplicada no mesmo arquivo`);
          fs.unlinkSync(tempPath);
          continue;
        }

        // Check cross-file
        let crossOwner: string | null = null;
        for (const [cachedHash, cachedEntityId] of this.globalPhotoHashCache) {
          if (cachedEntityId !== entityId && hammingDistance(hash, cachedHash) <= 10) {
            crossOwner = cachedEntityId;
            break;
          }
        }
        if (crossOwner) {
          console.log(`[Dedup] Foto pertence a outro arquivo (${crossOwner})`);
          fs.unlinkSync(tempPath);
          continue;
        }

        result.push(url);
        existingHashSet.add(hash);
        this.globalPhotoHashCache.set(hash, entityId);
        fs.unlinkSync(tempPath);
      } catch (err: any) {
        console.warn(`[Dedup] Erro ao processar foto: ${err.message}`);
        result.push(url);
      }
    }

    return result;
  }
}
```

- [ ] **Passo 3: Mover imageHash.ts pra scraper/**

```bash
cd telegram-scraper
mv src/imageHash.ts src/scraper/imageHash.ts
```

- [ ] **Passo 4: Commit**

```bash
cd telegram-scraper
git add src/scraper/types.ts src/scraper/photo-processing.ts src/scraper/imageHash.ts
git commit -m "feat(scraper): extract photo deduplication logic com cache persistente"
```

---

## Task 4: Refatorar Scraper Core (lógica de processamento de buffer)

**Arquivos:**
- Criar: `telegram-scraper/src/scraper/core.ts`

**Interfaces:**
- Consome: `PhotoDeduplicator`, `VaultUploader`, `TelegramClient`, tipos do Task 3
- Produz: `ScraperCore` class com método `processGroupMessages(groupId, messages)`

- [ ] **Passo 1: Extrair lógica de processamento de buffer**

Crie `telegram-scraper/src/scraper/core.ts` (extrato da função `processBufferedEntry` do index.ts original, mas sem Express/async handlers):

```typescript
import fs from "fs";
import path from "path";
import { TelegramClient } from "telegram";
import { CustomFile } from "telegram/client/uploads";
import { createClient } from "@supabase/supabase-js";
import { PhotoDeduplicator } from "./photo-processing";
import { VaultUploader } from "../telegram/vault";
import { ScraperJob, BufferedMessage } from "./types";

export class ScraperCore {
  private supabase: ReturnType<typeof createClient>;
  private photoDeduplicator: PhotoDeduplicator;
  private vaultUploader: VaultUploader;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    photoDeduplicator: PhotoDeduplicator,
    vaultUploader: VaultUploader
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.photoDeduplicator = photoDeduplicator;
    this.vaultUploader = vaultUploader;
  }

  async processMessages(
    client: TelegramClient,
    messages: BufferedMessage[],
    chatTitle: string,
    chatId: string
  ): Promise<void> {
    const docs = messages.filter((m) => m.type === "document");
    const photos = messages.filter((m) => m.type === "photo");

    if (docs.length === 0) {
      console.log(`[Scraper] Nenhum documento encontrado para ${chatTitle}`);
      return;
    }

    console.log(`[Scraper] Processando: ${docs.length} docs, ${photos.length} fotos`);

    // TODO: Implementar lógica de upload para Vault e indexação no Supabase
    // (Por enquanto, placeholder — será implementado em próximo task)
  }
}
```

- [ ] **Passo 2: Commit (placeholder)**

```bash
cd telegram-scraper
git add src/scraper/core.ts
git commit -m "feat(scraper): create ScraperCore class para processar mensagens"
```

---

## Task 5: Criar Comando CLI "scan"

**Arquivos:**
- Criar: `telegram-scraper/src/commands/scan.ts`

**Interfaces:**
- Consome: `TelegramClient`, `ScraperCore`, `loadConfig()`
- Produz: Command que quando executado, escava grupos monitorados e processa

- [ ] **Passo 1: Criar comando scan**

Crie `telegram-scraper/src/commands/scan.ts`:

```typescript
import { TelegramClient } from "telegram";
import { loadConfig } from "../config";
import { initTelegramClient, disconnectClient } from "../telegram/client";
import { VaultUploader } from "../telegram/vault";
import { ScraperCore } from "../scraper/core";
import { PhotoDeduplicator } from "../scraper/photo-processing";

export async function scanCommand(): Promise<void> {
  const config = loadConfig();
  let client: TelegramClient | null = null;

  try {
    console.log("🔍 Iniciando scan de grupos Telegram...\n");

    client = await initTelegramClient({
      apiId: config.telegram.apiId,
      apiHash: config.telegram.apiHash,
      session: config.telegram.session,
    });

    const vaultUploader = new VaultUploader(client, config.telegram.vaultChannelId);
    const photoDedup = new PhotoDeduplicator(".temp/photo_hash_cache.json");
    const scraper = new ScraperCore(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      photoDedup,
      vaultUploader
    );

    console.log("✅ Setup concluído\n");
    console.log("📝 Próximas etapas:");
    console.log("  1. Buscar configuração de grupos monitorados");
    console.log("  2. Escanear grupos");
    console.log("  3. Processar e uploadar para Vault\n");

    // TODO: Implementar lógica completa de scan
    console.log("⏳ Scan aguardando implementação de Task 6\n");

    photoDedup.saveCache();
  } catch (err: any) {
    console.error(`❌ Erro durante scan: ${err.message}`);
    process.exit(1);
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
}
```

- [ ] **Passo 2: Commit**

```bash
cd telegram-scraper
git add src/commands/scan.ts
git commit -m "feat(scraper): add scan command estrutura"
```

---

## Task 6: Criar Entry Point CLI com yargs

**Arquivos:**
- Criar: `telegram-scraper/src/index.ts`

**Interfaces:**
- Consome: `scanCommand()`, tipos do Task 3
- Produz: CLI entry point que aceita `scan` e `status` como subcomandos

- [ ] **Passo 1: Criar index.ts com CLI**

Crie `telegram-scraper/src/index.ts`:

```typescript
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { scanCommand } from "./commands/scan";

yargs(hideBin(process.argv))
  .command(
    "scan",
    "Escaneia grupos Telegram e faz upload para Vault",
    {},
    async () => {
      await scanCommand();
    }
  )
  .command(
    "status",
    "Mostra status dos jobs de scraper",
    {},
    async () => {
      console.log("⏳ Status command — em implementação");
    }
  )
  .option("verbose", {
    alias: "v",
    type: "boolean",
    description: "Modo verbose",
  })
  .help()
  .alias("help", "h")
  .strict()
  .parse();
```

- [ ] **Passo 2: Testar CLI localmente**

```bash
cd telegram-scraper
npm run dev scan
```

Esperado: Conecta ao Telegram, mostra "✅ Setup concluído", aguarda implementação.

- [ ] **Passo 3: Commit**

```bash
cd telegram-scraper
git add src/index.ts
git commit -m "feat(scraper): create CLI entry point com yargs"
```

---

## Task 7: Remover Express Server do index.ts original

**Arquivos:**
- Modificar: `telegram-scraper/src/index.ts` (remover tudo relacionado a Express)

**Interfaces:**
- Consome: Nada novo
- Produz: index.ts limpo com apenas CLI

- [ ] **Passo 1: Identificar quais funções/listeners podem ser removidos**

Na versão original do `index.ts`, remover:

```typescript
// ❌ REMOVER:
- express app setup
- app.get("/download", ...)
- app.get("/approve", ...)
- app.get("/retry", ...)
- app.get("/cancel", ...)
- app.get("/progress", ...)
- app.post("/backfill", ...)
- app.listen(port, ...)
- const activeDownloads = new Map()
- const cancelledJobs = new Set()
- const queue: (() => Promise<void>)[] = []
- let isProcessingQueue = false
```

- [ ] **Passo 2: Backup da versão original**

```bash
cd telegram-scraper
cp src/index.ts src/index.ts.backup
```

- [ ] **Passo 3: Reescrever index.ts como CLI puro**

```typescript
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { scanCommand } from "./commands/scan";

yargs(hideBin(process.argv))
  .command("scan", "Escaneia grupos e faz upload para Vault", {}, scanCommand)
  .command("status", "Mostra status de jobs", {}, () => {
    console.log("Status: em implementação");
  })
  .help()
  .alias("help", "h")
  .strict()
  .parse();
```

- [ ] **Passo 4: Commit**

```bash
cd telegram-scraper
git add src/index.ts
git commit -m "refactor(scraper): remove Express server, manter apenas CLI"
```

---

## Task 8: Documentar Separação e Fluxo de Uso

**Arquivos:**
- Criar: `docs/SCRAPER_ARCHITECTURE.md`
- Modificar: `telegram-scraper/README.md`

**Interfaces:**
- Consome: Conhecimento dos tasks anteriores
- Produz: Documentação clara do novo fluxo

- [ ] **Passo 1: Criar documento de arquitetura**

Crie `docs/SCRAPER_ARCHITECTURE.md`:

```markdown
# Arquitetura de Separação: Scraper CLI vs App Web

## Visão Geral

A aplicação foi separada em dois domínios independentes:

### 1. **Telegram Scraper CLI** (`/telegram-scraper`)
- **O quê:** Script Node.js que você executa manualmente
- **Quando:** Quando quer buscar novos STLs dos grupos Telegram
- **Como:** `npm run scan` na máquina local
- **Consumo:** Sua banda (download STL + upload Vault)
- **Saída:** Arquivos aparecem no seu Vault (grupo Telegram privado)

### 2. **Application Web** (`/src`)
- **O quê:** App React que roda no Vercel
- **Quando:** 24/7, sempre disponível
- **Como:** Usuários acessam `https://seu-site.vercel.app`
- **Consumo:** Banda do Vercel (praticamente nada — só HTML/JS/CSS)
- **Entrada:** Lê do Vault (via Supabase)

## Fluxo de Dados

```
Grupos Telegram A, B, C (você coloca STLs lá)
    ↓ (você roda: npm run scan)
Scraper CLI (sua máquina)
    ↓ detecta → baixa → sobe
Vault (seu grupo privado)
    ↓
App Web (Vercel)
    ↓ usuário clica
Tester acessa STL
```

## Variáveis de Ambiente

### Scraper (`.env` local)
```
TELEGRAM_API_ID=...
TELEGRAM_API_HASH=...
TELEGRAM_SESSION=...
TELEGRAM_VAULT_CHANNEL_ID=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### App (Vercel → Settings → Environment Variables)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Próximas Etapas

- [ ] Implementar lógica completa de scan no `src/scraper/core.ts`
- [ ] Testar scraper localmente
- [ ] Deploy app no Vercel
- [ ] Migrar fotos para Cloudflare R2 (opcional)
```

- [ ] **Passo 2: Atualizar README do scraper**

Modifique `telegram-scraper/README.md`:

```markdown
# Telegram Scraper CLI

Ferramenta de linha de comando para escanear grupos Telegram e fazer upload de STLs para seu Vault privado.

## Setup

1. `npm install`
2. Copie `.env.example` para `.env` e preencha credenciais
3. `npm run dev scan` para testar

## Uso

\`\`\`bash
# Scan de grupos monitorados
npm run scan

# Ver status de jobs
npm run status
\`\`\`

## Arquitetura

Este é um **CLI independente** da app web. Roda localmente na sua máquina quando você quer.
Para detalhes completos, veja `docs/SCRAPER_ARCHITECTURE.md`.
```

- [ ] **Passo 3: Commit**

```bash
git add docs/SCRAPER_ARCHITECTURE.md telegram-scraper/README.md
git commit -m "docs: add scraper architecture documentation"
```

---

## Resumo das Mudanças

| O quê | Antes | Depois |
|-------|-------|--------|
| **Scraper executa** | 24/7, background listener | Manualmente (`npm run scan`) |
| **Servidor** | Express + API routes | CLI com yargs |
| **Endpoints** | `/download`, `/approve`, etc | Não existem (tudo local) |
| **Entrada** | Escuta eventos Telegram | Você roda manualmente |
| **Saída** | Vault + Supabase | Vault + Supabase (mesmo) |

---

## Self-Review (Verificação)

✅ **Spec Coverage:**
- Separação scraper/app: Task 1-8 cobrem
- CLI independente: Tasks 5-6 cobrem
- Sem mudanças em banco de dados: ✅ Confirmado (apenas leitura)
- Sem mudanças em auth externas: ✅ Confirmado

✅ **Placeholders:** Apenas 2 TODOs para próximas implementações (ScraperCore logic, status command)

✅ **Consistência de tipos:** 
- `ScraperJob` definido em `types.ts`
- `PhotoDeduplicator` criado em Task 3
- `VaultUploader` criado em Task 2
- Todos os imports respeitam a hierarquia

