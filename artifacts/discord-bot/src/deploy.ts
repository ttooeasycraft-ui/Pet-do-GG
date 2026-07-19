/**
 * Registra os slash commands no servidor (guild).
 * Execute com: pnpm --filter @workspace/discord-bot run deploy
 */
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN não configurado.');
  process.exit(1);
}
if (!guildId) {
  console.error('❌ GUILD_ID não configurado.');
  process.exit(1);
}

// Extrai o Application ID do token (base64 da primeira parte)
const clientId = Buffer.from(token.split('.')[0], 'base64').toString('ascii');
console.log(`📦 Registrando comandos para aplicação: ${clientId}`);

const commands = [
  new SlashCommandBuilder()
    .setName('sorteio')
    .setDescription('Sorteia jogadores para uma partida')
    .addStringOption((opt) =>
      opt
        .setName('modo')
        .setDescription('Escolha o modo de sorteio')
        .setRequired(true)
        .addChoices(
          { name: '🛡️⚔️💊 Por Função (1 Tanque, 2 Dano, 2 Suporte)', value: 'funcoes' },
          { name: '🎲 Simples — 5 aleatórios de uma lista', value: 'simples' }
        )
    ),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('⏳ Registrando comandos slash...');
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log(`✅ ${(data as unknown[]).length} comando(s) registrado(s) com sucesso!`);
  } catch (err) {
    console.error('❌ Erro ao registrar comandos:', err);
    process.exit(1);
  }
})();
