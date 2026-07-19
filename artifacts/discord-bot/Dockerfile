FROM node:24-slim

# Instala pnpm globalmente
RUN npm install -g pnpm@10

WORKDIR /app

# Copia arquivos de configuração do workspace (contexto = raiz do repo)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./

# Copia apenas o pacote do bot
COPY artifacts/discord-bot ./artifacts/discord-bot

# Instala somente as dependências do bot
RUN pnpm --filter @workspace/discord-bot install --frozen-lockfile

# Inicia o bot (lê DISCORD_BOT_TOKEN, GUILD_ID e WELCOME_CHANNEL_ID do ambiente Railway)
CMD ["pnpm", "--filter", "@workspace/discord-bot", "run", "start"]
