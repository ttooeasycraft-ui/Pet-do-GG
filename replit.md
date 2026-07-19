# Pet do GG — Discord Bot

Bot de Discord com boas-vindas automáticas e comando de sorteio de times.

## Run & Operate

- `Pet do GG — Discord Bot` — workflow que mantém o bot online
- `pnpm --filter @workspace/discord-bot run deploy` — registra os comandos slash no servidor (rodar uma vez após configurar o GUILD_ID)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- discord.js v14
- tsx (execução direta de TypeScript)

## Where things live

- `artifacts/discord-bot/src/index.ts` — entrada principal do bot
- `artifacts/discord-bot/src/commands/sorteio.ts` — lógica do comando /sorteio
- `artifacts/discord-bot/src/events/welcome.ts` — lógica das boas-vindas
- `artifacts/discord-bot/src/deploy.ts` — script para registrar slash commands

## Secrets obrigatórios

- `DISCORD_BOT_TOKEN` — token do bot (já configurado)

## Variáveis de ambiente obrigatórias

- `WELCOME_CHANNEL_ID` — ID numérico do canal onde mandar boas-vindas
- `GUILD_ID` — ID numérico do servidor Discord (para registrar slash commands)

Para pegar os IDs: ative o Modo Desenvolvedor no Discord (Configurações > Avançado),
depois clique com botão direito no servidor/canal e escolha "Copiar ID".

## Gotchas

- Após corrigir o GUILD_ID, rodar `pnpm --filter @workspace/discord-bot run deploy` para registrar o comando /sorteio
- O bot precisa da permissão "Server Members Intent" ativada no Discord Developer Portal (Bot > Privileged Gateway Intents)
- Para imagem de boas-vindas: adicionar o arquivo em `artifacts/discord-bot/src/assets/` e referenciar em `welcome.ts`
