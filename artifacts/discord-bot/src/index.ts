import {
  Client,
  GatewayIntentBits,
  Events,
  Interaction,
  GuildMember,
} from 'discord.js';

import { loadConfig } from './config.js';
import { handleSorteio, handleSorteioModal } from './commands/sorteio.js';
import { handleWelcome } from './events/welcome.js';
import { handleTicketSetup, handleTicketSelect, handleTicketClose } from './commands/ticket.js';
import { handleEditar, handleEditarModal } from './commands/editar.js';

// Força stdout sem buffer para que os logs apareçam no workflow
process.stdout.write('');

// ── Validação de variáveis de ambiente ────────────────────────────────────────
const token          = process.env.DISCORD_BOT_TOKEN;
const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
const guildId        = process.env.GUILD_ID;

if (!token) {
  process.stderr.write('❌ DISCORD_BOT_TOKEN não configurado.\n');
  process.exit(1);
}

const isValidSnowflake = (v: string | undefined) => /^\d{17,20}$/.test(v ?? '');

if (!isValidSnowflake(welcomeChannelId)) {
  process.stderr.write(
    `⚠️  WELCOME_CHANNEL_ID inválido: "${welcomeChannelId}"\n` +
    '   Boas-vindas desativadas até que o ID correto seja configurado.\n'
  );
}
if (!isValidSnowflake(guildId)) {
  process.stderr.write(
    `⚠️  GUILD_ID inválido: "${String(guildId).slice(0, 60)}"\n` +
    '   Corrija e rode: pnpm --filter @workspace/discord-bot run deploy\n'
  );
}

// ── Carrega configuração persistida ──────────────────────────────────────────
loadConfig();

// ── Contagem de votos em memória (por mensagem) ───────────────────────────────
const voteData = new Map<string, { sim: number; nao: number; voters: Set<string> }>();

// ── Cliente Discord ───────────────────────────────────────────────────────────
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

// ── Boas-vindas ───────────────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, (member: GuildMember) => {
  handleWelcome(member).catch((err) =>
    console.error('[Welcome] Erro ao enviar boas-vindas:', err)
  );
});

// ── Interações ────────────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    // ── Slash commands ────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case 'sorteio':       await handleSorteio(interaction);      break;
        case 'ticket-painel': await handleTicketSetup(interaction);  break;
        case 'editar-texto':  await handleEditar(interaction);       break;
      }
      return;
    }

    // ── Modais ────────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('sorteio_')) {
        await handleSorteioModal(interaction);
      } else if (interaction.customId.startsWith('editar_')) {
        await handleEditarModal(interaction);
      }
      return;
    }

    // ── Select menus ──────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'ticket_select') {
        await handleTicketSelect(interaction);
      }
      return;
    }

    // ── Botões ────────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      if (interaction.customId === 'ticket_close') {
        await handleTicketClose(interaction);
      } else if (interaction.customId === 'feedback_sim' || interaction.customId === 'feedback_nao') {
        const msgId  = interaction.message.id;
        const userId = interaction.user.id;
        const isSim  = interaction.customId === 'feedback_sim';

        // Inicializa contadores para esta mensagem
        if (!voteData.has(msgId)) voteData.set(msgId, { sim: 0, nao: 0, voters: new Set() });
        const data = voteData.get(msgId)!;

        if (data.voters.has(userId)) {
          await interaction.reply({ content: 'Você já votou!', flags: 64 });
          return;
        }

        data.voters.add(userId);
        if (isSim) data.sim++; else data.nao++;

        // Edita a mensagem com os botões atualizados
        await interaction.update({
          components: [{
            type: 1,
            components: [
              { type: 2, custom_id: 'feedback_sim', label: `Sim  ·  ${data.sim}`, style: 3 },
              { type: 2, custom_id: 'feedback_nao', label: `Não  ·  ${data.nao}`, style: 4 },
            ],
          }],
        });
      }
      return;
    }
  } catch (err) {
    console.error('[Interaction] Erro:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: '❌ Ocorreu um erro ao processar a interação.', flags: 64 })
        .catch(() => null);
    }
  }
});

client.login(token);
