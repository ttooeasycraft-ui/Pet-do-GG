/**
 * Registra os slash commands no servidor (guild).
 * Execute com: pnpm --filter @workspace/discord-bot run deploy
 */
import {
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { CARD_POOL, RARITY_LABELS } from './game/cards.js';

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

  new SlashCommandBuilder()
    .setName('roleta')
    .setDescription('Cria uma roleta animada (máximo de 30 opções)'),

  new SlashCommandBuilder()
    .setName('tempo-suporte')
    .setDescription('Define quando um ticket fecha por falta de resposta')
    .addChannelOption((opt) =>
      opt
        .setName('canal')
        .setDescription('Canal do ticket que receberá o prazo')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('tempo')
        .setDescription('Quantidade de tempo sem resposta')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('unidade')
        .setDescription('Unidade do prazo')
        .setRequired(false)
        .addChoices(
          { name: 'Segundos', value: 'segundos' },
          { name: 'Minutos', value: 'minutos' },
          { name: 'Horas', value: 'horas' },
          { name: 'Dias', value: 'dias' },
          { name: 'Meses (30 dias)', value: 'meses' },
          { name: 'Anos (365 dias)', value: 'anos' },
        )
    ),

  new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Mostra o ranking individual de XP do chat'),

  new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Mostra seu XP de chat, tempo em call e cargos atuais'),

  new SlashCommandBuilder()
    .setName('cartas')
    .setDescription('Colecione cartas, monte seu deck e dispute X1')
    .addSubcommand((subcommand) =>
      subcommand.setName('puxar').setDescription('Tente conseguir uma carta nova (intervalo de 6 horas)')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('diaria').setDescription('Receba moedas pelas cartas da sua coleção')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('colecao')
        .setDescription('Mostra as cartas e as estatísticas de um jogador')
        .addUserOption((option) => option.setName('jogador').setDescription('Jogador').setRequired(false))
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('deck').setDescription('Mostra seu deck atual')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('adicionar')
        .setDescription('Adiciona uma carta sua ao deck')
        .addStringOption((option) =>
          option
            .setName('carta')
            .setDescription('Carta da sua coleção')
            .setRequired(true)
            .addChoices(...CARD_POOL.map((card) => ({
              name: `${card.name} (${RARITY_LABELS[card.rarity]})`,
              value: card.id,
            })))
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remover')
        .setDescription('Remove uma carta do seu deck')
        .addStringOption((option) =>
          option
            .setName('carta')
            .setDescription('Carta para remover')
            .setRequired(true)
            .addChoices(...CARD_POOL.map((card) => ({
              name: `${card.name} (${RARITY_LABELS[card.rarity]})`,
              value: card.id,
            })))
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('upar')
        .setDescription('Aumenta o dano ou HP de uma carta sua')
        .addStringOption((option) =>
          option
            .setName('carta')
            .setDescription('Carta para melhorar')
            .setRequired(true)
            .addChoices(...CARD_POOL.map((card) => ({
              name: `${card.name} (${RARITY_LABELS[card.rarity]})`,
              value: card.id,
            })))
        )
        .addStringOption((option) =>
          option
            .setName('atributo')
            .setDescription('Atributo que receberá o upgrade')
            .setRequired(true)
            .addChoices(
              { name: 'Dano', value: 'damage' },
              { name: 'HP', value: 'hp' },
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('duelo')
        .setDescription('Desafia outro jogador para um X1')
        .addUserOption((option) => option.setName('jogador').setDescription('Oponente').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('ranking').setDescription('Mostra o ranking de vitórias em X1')
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
