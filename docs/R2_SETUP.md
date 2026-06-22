# Guia — Configurar o Cloudflare R2 (armazém dos STLs)

> Passo-a-passo para um não-expert. Ao final você terá **4 valores** para me passar (ou colar nos `.env`).
> Contexto: o R2 guarda os arquivos `.stl` e os entrega ao usuário (egress grátis). Ver `ARCHITECTURE.md` §6.

## Por que isso
Enquanto o R2 não estiver configurado, o código fica **dormente** (o studio cai no fluxo antigo e o scraper usa o Vault). Com as 4 chaves preenchidas, o download passa a vir do R2 e o scraper sobe novos arquivos pra lá.

---

## Passo 1 — Criar conta Cloudflare
1. Acesse https://dash.cloudflare.com/sign-up e crie uma conta (grátis).
2. Confirme o e-mail e faça login.

## Passo 2 — Ativar o R2
1. No menu lateral, clique em **R2**.
2. Clique em **"Purchase R2 Plan"** / **"Get started"**. O plano free não cobra egress; só pede um cartão para validação (cobra só se passar do limite grátis — ~10GB).

## Passo 3 — Criar o bucket (a "gaveta" dos arquivos)
1. Em R2 → **"Create bucket"**.
2. Nome: `lb-stls` (ou outro — anote, é o `R2_BUCKET`).
3. **Deixe PRIVADO** (não habilite "Public access"). O studio entrega via link assinado temporário.
4. Criar.

## Passo 4 — Gerar o Token de API (as credenciais)
1. Em R2 → **"Manage R2 API Tokens"** (canto superior direito) → **"Create API token"**.
2. Permissão: **"Object Read & Write"**.
3. (Opcional) Restrinja ao bucket `lb-stls`.
4. Criar. A tela vai mostrar **uma vez só**:
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`
   - Copie os dois agora (o secret não reaparece).

## Passo 5 — Pegar o Account ID
1. Na página do R2, no canto direito, há **"Account ID"** (ou na URL do dashboard). É o `R2_ACCOUNT_ID`.

---

## Os 4 valores
| Variável | Onde achei |
|----------|-----------|
| `R2_ACCOUNT_ID` | Passo 5 |
| `R2_ACCESS_KEY_ID` | Passo 4 |
| `R2_SECRET_ACCESS_KEY` | Passo 4 |
| `R2_BUCKET` | nome do Passo 3 (ex.: `lb-stls`) |

## Onde colocar
Cole os 4 nos **dois** arquivos (eles já estão listados no `.env.example` do scraper):
- **Studio:** `lb-creative-studio/.env.local`
- **Scraper:** `lb-creative-scrapper/.env`

```env
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=lb-stls
```

> ⚠️ Nunca commitar esses valores (os `.env*` já estão no `.gitignore`).

---

## Depois de configurar
1. **Arquivos novos**: o scraper (`npm run daemon`) passa a subir automaticamente pro R2.
2. **Arquivos antigos** (já indexados, hoje no Vault): rodar o backfill **uma vez** para copiá-los pro R2:
   ```bash
   cd lb-creative-scrapper
   npm run backfill:r2
   ```
   (Precisa do scraper logado no Telegram e das chaves R2 preenchidas.)
3. Me avise que eu valido o download de ponta a ponta.
