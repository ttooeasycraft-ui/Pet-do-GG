---
name: Painéis Discord experimentais
description: Regra para publicar protótipos interativos com botões no Discord sem criar ações inertes ou menções acidentais.
---

Botões e menus do Discord precisam de um listener persistente no bot para executar ações; publicar componentes por uma operação temporária apenas desenha a interface e não processa cliques.

**Why:** Um painel experimental publicado antes sem handler parecia funcional, mas não respondia aos cliques. Também houve risco de uma mensagem de teste disparar `@everyone` em um canal privado.

**How to apply:** Antes de publicar um protótipo, criar o handler no bot, limitar cada interação ao ID do canal de teste, responder de forma efêmera quando possível e enviar mensagens com menções desativadas (`allowedMentions` sem `parse`).

O fluxo de boas-vindas existente deve permanecer direto e sem debounce ou consulta extra ao histórico; alterações de proteção nesse fluxo podem impedir o envio esperado. Funcionalidades experimentais devem ficar isoladas em seus próprios módulos e canais.

**Why:** A proteção adicional de duplicação atrasou/bloqueou o comportamento de boas-vindas que já estava aprovado pelo usuário, então foi revertida sem remover o matchmaking.

**How to apply:** Ao adicionar recursos de teste, não refatorar `events/welcome.ts`; se uma mudança ali for realmente necessária, comparar com a última versão aprovada e validar o envio antes de manter.

Protótipos de comandos Discord podem ser registrados no servidor sem serem lançamentos oficiais quando o handler restringe uso por canal e por cargo/dona; a autorização deve ser confirmada no próprio fluxo antes de ampliar o escopo.

**Why:** A roleta foi criada para demonstração antes de virar recurso oficial, com limite de opções, animação temporária e estado apenas em memória.

**How to apply:** Para novos protótipos, registrar o comando no servidor, limitar o canal de teste, responder sem menções amplas e deixar claro no painel que a versão ainda é experimental.