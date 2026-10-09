---
name: Proteção do XP e ranking
description: O backup local de configuração contém XP e ranking dos membros do servidor.
---

O usuário informou que `data/config.json` guarda o XP e o ranking de todos; uma versão antiga pode apagar o progresso.

**Why:** o usuário pediu explicitamente para não sobrescrever esse arquivo ao enviar código ao GitHub.

**How to apply:** antes de qualquer push ou restauração, mantenha fora do commit uma cópia antiga de `data/config.json`; preserve o arquivo atual e use a persistência MongoDB para o progresso.
