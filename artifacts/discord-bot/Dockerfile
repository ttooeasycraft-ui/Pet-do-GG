FROM node:24-slim

# Instala pnpm globalmente
RUN npm install -g pnpm@10

WORKDIR /app

# Copia arquivos de configuração do workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./

# Copia apenas o pacote do bot e suas dependências locais
COPY artifacts/discord-bot ./artifacts/discord-bot

# Instala somente as dependências do bot (sem as de outros artefatos)
RUN pnpm --filter @workspace/discord-bot install --frozen-lockfile

# Variáveis de ambiente obrigatórias (valores reais devem ser configurados no Railway)
ENV DISCORD_BOT_TOKEN=""
ENV GUILD_ID=""
ENV WELCOME_CHANNEL_ID=""

# Inicia o bot com tsx diretamente
CMD ["pnpm", "--filter", "@workspace/discord-bot", "run", "dev"]
