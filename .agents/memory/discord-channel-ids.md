---
name: IDs de canais Discord
description: Persistência e validação de IDs de canais que o bot usa para roteamento ou moderação.
---

Para listeners persistentes, prefira o ID do canal configurado e valide que ele pertence ao servidor esperado. Use a busca por nome apenas como fallback; o Discord pode normalizar pontuação e letras estilizadas ao criar canais, então a comparação exata pode falhar e criar duplicatas.

**Why:** Os nomes com fonte decorativa foram normalizados pelo Discord durante a criação, tornando a busca exata por nome insuficiente para identificar o canal já criado.

**How to apply:** Antes de anexar eventos de moderação ou comandos a um canal, busque pelo ID salvo, confirme o servidor e confira as permissões necessárias.
