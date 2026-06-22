# Fluxo de Trabalho com Git — LB Creative

> Documento para o dono (não-expert em git) e regra obrigatória para o assistente de IA.
> Objetivo: **nunca perder trabalho** e manter a `main` sempre funcionando.

## Conceitos em 30 segundos (pra quem não é de git)

- **Commit** = um "save point" do código. Cada commit fica guardado e dá pra voltar nele.
- **main** = a linha principal, que deve estar **sempre funcionando**.
- **Branch** = uma "cópia paralela" da main pra mexer sem risco. Se der errado, joga fora a branch e a main continua intacta.
- **Push** = enviar os commits pro GitHub (seu backup na nuvem). **Enquanto não der push, o trabalho só existe no seu computador.**
- **PR (Pull Request)** = um "pedido de juntar" a branch na main, com uma descrição do que mudou. Serve de revisão antes de oficializar.
- **Merge** = juntar a branch aprovada na main.
- **Tag** = uma marca num ponto específico (ex.: `pre-r2-migration`) pra achar fácil depois.

## A regra de ouro
> **Trabalho que não foi pro GitHub (push) não está seguro.** Faça push cedo e com frequência.

---

## 🤖 Regra Obrigatória do Assistente (aplicar SEMPRE, mesmo sem o dono pedir)

O dono **não é expert em git e não vai pedir** pra criar branch, abrir PR ou subir nada. Portanto, o assistente **assume o controle do fluxo de git por conta própria**, em toda tarefa de desenvolvimento:

1. **Avaliar o risco antes de codar:**
   - Mudança **trivial e segura** (doc, texto, config pequena, ajuste isolado) → pode ir direto na branch atual e commitar.
   - **Código que muda comportamento**, feature nova, fix não-trivial, mudança de banco, ou algo arriscado → **criar uma branch dedicada** a partir da `main` atualizada, com nome claro (`feat/...`, `fix/...`, `chore/...`).
2. **Trabalhar na branch** com commits pequenos e descritivos.
3. **Push da branch** assim que houver progresso (backup).
4. **Ao concluir e validar:** abrir **PR** com descrição do que mudou e por quê.
5. **Merge na `main`** após o ok do dono. Depois, apagar a branch.
6. **Confirmar antes** de ações irreversíveis ou sensíveis: merge na `main`, rodar **migrations de banco**, **rotacionar chaves**, **deletar** arquivos/dados, qualquer coisa que afete produção.
7. **Nunca commitar segredos** (`.env*`, tokens, chaves). Manter o `.gitignore` correto.
8. **Sempre avisar o dono em linguagem simples** o que foi feito no git ("criei a branch X", "abri o PR Y", "fiz merge na main") — ele não acompanha esses comandos sozinho.
9. Se a `main` acumular commits **não enviados**, lembrar/fazer o **push** como medida anti-perda.

> Em resumo: o assistente cuida de branch → commit → push → PR → merge **de ponta a ponta**, narrando cada passo, e só pausa pra pedir ok nos pontos sensíveis (merge na main, migrations, chaves, deleção).

---

## Fluxo típico de uma tarefa (exemplo)
```
1. git switch -c feat/nome-da-tarefa     # cria branch a partir da main
2. ... desenvolve + git commit (vários, pequenos) ...
3. git push -u origin feat/nome-da-tarefa # sobe a branch (backup + base do PR)
4. abre PR no GitHub (gh pr create)       # descrição do que mudou
5. (ok do dono) → merge na main
6. git branch -d feat/nome-da-tarefa      # limpa a branch
```

## Pontos de restauração importantes
- Tag **`pre-r2-migration`** marca o estado bom **antes** da grande migração para Cloudflare R2. Pra voltar a esse ponto: `git switch -c recuperacao pre-r2-migration`.
