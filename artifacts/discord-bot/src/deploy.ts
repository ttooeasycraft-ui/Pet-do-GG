/**
 * Registra os slash commands no servidor (guild).
 * Execute com: pnpm --filter @workspace/discord-bot run deploy
 */
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const token   = process.env.DISCORD_BOT_TOKEN;
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
  // ── /sorteio ──────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('sorteio')
    .setDescription('Sorteia jogadores para uma partida de Overwatch')
    .addStringOption((opt) =>
      opt
        .setName('modo')
        .setDescription('Modo de sorteio')
        .setRequired(true)
        .addChoices(
          { name: 'Por Função (1 Tank · 2 Dano · 2 Suporte)', value: 'funcoes' },
          { name: 'Simples — N aleatórios de uma lista',       value: 'simples' }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName('quantidade')
        .setDescription('Quantos jogadores sortear (modo Simples — padrão: 5, máx: 100)')
        .setRequired(false)
        .setMinValue(2)
        .setMaxValue(100)
    ),

  // ── /ticket-painel ────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('ticket-painel')
    .setDescription('Envia o painel de tickets no canal configurado (apenas administradores)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ── /editar-texto ─────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('editar-texto')
    .setDescription('Edita os textos do bot sem mexer no código (apenas staff)')
    .addStringOption((opt) =>
      opt
        .setName('secao')
        .setDescription('Qual texto editar?')
        .setRequired(true)
        .addChoices(
          { name: 'Boas-vindas — texto e imagem do embed de entrada',  value: 'boas-vindas'    },
          { name: 'Painel de Suporte — texto e imagem do painel',      value: 'painel-suporte' }
        )
    ),

  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ferramentas do sistema de tickets')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('alert')
        .setDescription('Lembra o responsável de responder no ticket atual')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('rank')
        .setDescription('Mostra o ranking de uso e atendimento dos tickets')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('voice')
        .setDescription('Cria uma call "Suporte Call" sem limite vinculada ao ticket atual')
    ),

  new SlashCommandBuilder()
    .setName('user')
    .setDescription('Consulta informações públicas de usuários')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('avatar')
        .setDescription('Mostra o avatar de um usuário')
        .addUserOption((opt) =>
          opt.setName('usuario').setDescription('Usuário').setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('info')
        .setDescription('Mostra informações públicas de um usuário')
        .addUserOption((opt) =>
          opt.setName('usuario').setDescription('Usuário').setRequired(false)
        )
    ),

  new SlashCommandBuilder()
    .setName('sugerir')
    .setDescription('Envia uma sugestão para a equipe')
    .addStringOption((opt) =>
      opt
        .setName('ideia')
        .setDescription('Escreva sua sugestão')
        .setRequired(true)
        .setMaxLength(1000)
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
