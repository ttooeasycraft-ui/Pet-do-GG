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