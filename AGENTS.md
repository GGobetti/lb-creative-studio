<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Fluxo de Git — REGRA OBRIGATÓRIA

O dono não é expert em git e **não vai pedir** branch/PR/merge. O assistente **assume o fluxo de git por conta própria** em toda tarefa: avaliar se precisa de branch dedicada (sim para qualquer código que mude comportamento/feature/fix não-trivial/banco; direto na branch atual só para docs/ajustes triviais), commitar em passos pequenos, dar **push cedo** (anti-perda), abrir **PR**, e fazer **merge na main** após ok do dono. **Confirmar antes** de: merge na main, migrations, rotação de chaves, deleções, ou qualquer coisa que afete produção. **Nunca commitar segredos.** **Sempre narrar** os passos de git em linguagem simples. Detalhes completos: [`docs/WORKFLOW.md`](docs/WORKFLOW.md).
