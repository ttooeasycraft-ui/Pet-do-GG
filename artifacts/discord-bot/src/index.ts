import {
  Client,
  GatewayIntentBits,
  Events,
  Interaction,
  GuildMember,
} from 'discord.js';
import { handleSorteio, handleSorteioModal } from './commands/sorteio.js';
import { handleWelcome } from './events/welcome.js';

// Força stdout sem buffer para que os logs apareçam no workflow
process.stdout.write('');

const token = process.env.DISCORD_BOT_TOKEN;
const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
const guildId = process.env.GUILD_ID;

if (!token) {
  process.stderr.write('❌ DISCORD_BOT_TOKEN não configurado.\n');
  process.exit(1);
}

const isValidSnowflake = (v: string | undefined) => /^\d{17,20}$/.test(v ?? '');

if (!isValidSnowflake(welcomeChannelId)) {
  process.stderr.write(
    `⚠️  WELCOME_CHANNEL_ID inválido: "${welcomeChannelId}"\n` +
    '   Deve ser um ID numérico do Discord (ex: 1234567890123456789).\n' +
    '   Boas-vindas desativadas até que o ID correto seja configurado.\n'
  );
}
if (!isValidSnowflake(guildId)) {
  process.stderr.write(
    `⚠️  GUILD_ID inválido: "${String(guildId).slice(0, 60)}..."\n` +
    '   Deve ser o ID numérico do servidor (ex: 1234567890123456789).\n' +
    '   Para registrar os comandos slash, corrija o GUILD_ID e rode:\n' +
    '   pnpm --filter @workspace/discord-bot run deploy\n'
  );
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Pet do GG online como: ${c.user.tag}`);
  console.log(`🔗 Servidores conectados: ${c.guilds.cache.size}`);
});

// ── Boas-vindas ──────────────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, (member: GuildMember) => {
  handleWelcome(member).catch((err) =>
    console.error('[Welcome] Erro ao enviar boas-vindas:', err)
  );
});

// ── Interações (slash commands + modais) ─────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === 'sorteio'
    ) {
      await handleSorteio(interaction);
    } else if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith('sorteio_')
    ) {
      await handleSorteioModal(interaction);
    }
  } catch (err) {
    console.error('[Interaction] Erro:', err);
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction
        .reply({ content: '❌ Ocorreu um erro ao processar o comando.', ephemeral: true })
        .catch(() => null);
    }
  }
});

client.login(token);
