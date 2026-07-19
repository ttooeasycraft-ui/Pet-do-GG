/**
 * Registra os slash commands no servidor (guild).
 * Execute com: pnpm --filter @workspace/discord-bot run deploy
 */
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const token  = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN não configurado.');
  process.exit(1);
}
if (!guildId || !/^\d{17,20}$/.test(guildId)) {
  console.error(`❌ GUILD_ID inválido: "${guildId}"`);
  process.exit(1);
}

const clientId = Buffer.from(token.split('.')[0], 'base64').toString('ascii');
console.log(`📦 Registrando comandos para aplicação: ${clientId}`);

const commands = [
  new SlashCommandBuilder()
    .setName('sorteio')
    .setDescription('Sorteia jogadores para uma partida de Overwatch')
    .addStringOption((opt) =>
      opt
        .setName('modo')
        .setDescription('Escolha o modo de sorteio')
        .setRequired(true)
        .addChoices(
          { name: '🛡️⚔️❤️ Por Função (1 Tank · 2 Dano · 2 Suporte)', value: 'funcoes' },
          { name: '🎲 Simples — N aleatórios de uma lista', value: 'simples' }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName('quantidade')
        .setDescription('Quantos jogadores sortear (só para o modo Simples — padrão: 5)')
        .setRequired(false)
        .setMinValue(2)
        .setMaxValue(12)
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
