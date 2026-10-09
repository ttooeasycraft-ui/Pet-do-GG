import {
  Client,
  GatewayIntentBits,
  Events,
  Interaction,
  GuildMember,
  Message,
  MessageFlags,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { MongoClient } from 'mongodb';

import antispam from './antispam.js';
import { loadConfig } from './config.js';
import { handleSorteio, handleSorteioModal } from './commands/sorteio.js';
import { handleCardGameButton, handleCardGameCommand } from './commands/cartas.js';
import { handleWelcome } from './events/welcome.js';
import {
  handleCreateCallButton,
  handleCreateCallModal,
  handleTicketAlert,
  handleTicketClose,
  handleTicketRank,
  handleTicketSelect,
  handleTicketSetup,
  handleTicketVoice,
  handleTicketVoiceButton,
} from './commands/ticket.js';
import {
  handleSupportMessage,
  handleSupportTimeout,
  initializeSupportTimeouts,
} from './commands/suporte.js';
import { handleEditar, handleEditarModal } from './commands/editar.js';
import { handleSuggestion, handleUserAvatar, handleUserInfo } from './commands/user.js';
import {
  SUGGESTIONS_CHANNEL_ID,
  XP_COMMAND_CHANNEL_ID,
} from './constants.js';
import { handleVoiceStateUpdate } from './events/voice.js';
import {
  handleVoiceXpStateUpdate,
  initializeVoiceXp,
} from './events/voice-xp.js';
import { handleMatchmakingButton } from './commands/matchmaking.js';
import {
  handleRoulette,
  handleRouletteButton,
  handleRouletteModal,
} from './commands/roleta.js';
import { handleRanking } from './commands/ranking.js';
import { handleXp } from './commands/xp.js';
import {
  handleChatXpMessage,
  initializeChatXp,
} from './events/chat-xp.js';
import { connectGameDatabase } from './game/database.js';

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

// ── Contagem de votos em memória (por mensagem) ───────────────────────────────
const voteData = new Map<string, { sim: number; nao: number; voters: Set<string> }>();

// ── Cliente Discord ───────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

const ANTISPAM_CHANNEL_NAME = '﹕₊˚ʚ🛡️ଓ﹕𝗔𝗡𝗧𝗜‧𝗦𝗣𝗔𝗠︵୭';
const ANTISPAM_CHANNEL_CANONICAL_SUFFIX = '𝗔𝗡𝗧𝗜‧𝗦𝗣𝗔𝗠︵୭';
let detachAntispam: (() => void) | null = null;

async function initializeAntispamChannel(c: Client): Promise<void> {
  if (typeof guildId !== 'string' || !isValidSnowflake(guildId)) {
    console.error('[Antispam] GUILD_ID inválido; canal não criado.');
    return;
  }
  const configuredChannelId = process.env.ANTISPAM_CHANNEL_ID;
  if (configuredChannelId && !isValidSnowflake(configuredChannelId)) {
    console.error('[Antispam] ANTISPAM_CHANNEL_ID inválido; listener não ativado.');
    return;
  }

  const guild = await c.guilds.fetch(guildId);
  const botMember = await guild.members.fetchMe();
  let channel = configuredChannelId
    ? await guild.channels.fetch(configuredChannelId).catch(() => null)
    : null;

  if (channel && channel.guildId !== guild.id) {
    console.error('[Antispam] O canal configurado pertence a outro servidor; listener não ativado.');
    return;
  }
  if (!channel) {
    const existingChannels = await guild.channels.fetch();
    channel =
      existingChannels.find((item) => item?.name === ANTISPAM_CHANNEL_NAME) ??
      existingChannels.find((item) =>
        item?.name.startsWith('﹕₊˚ʚ🛡️') &&
        item.name.endsWith(ANTISPAM_CHANNEL_CANONICAL_SUFFIX),
      ) ??
      null;
  }

  if (!channel) {
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      console.error('[Antispam] O bot não tem permissão para criar o canal.');
      return;
    }
    channel = await guild.channels.create({
      name: ANTISPAM_CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: 'Canal protegido: qualquer mensagem enviada aqui resulta em banimento automático imediato.',
      reason: 'Canal dedicado ao antispam solicitado pela administração.',
    });
    console.log(`[Antispam] Canal criado: ${channel.name} (${channel.id}).`);
  }

  if (channel.type !== ChannelType.GuildText) {
    console.error('[Antispam] Já existe um canal com esse nome, mas ele não é um canal de texto.');
    return;
  }
  if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
    console.error('[Antispam] O bot não tem permissão de banir membros; listener não ativado.');
    return;
  }
  if (!channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ViewChannel)) {
    console.error('[Antispam] O bot não consegue visualizar o canal; listener não ativado.');
    return;
  }

  detachAntispam?.();
  detachAntispam = antispam.attachAntispam(c, channel.id, {
    reason: 'Banimento automático: mensagem enviada no canal antispam.',
  });
  console.log(`[Antispam] Banimento automático ativado somente em #${channel.name}.`);
}

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Pet do GG online como: ${c.user.username}`);
  console.log(`🔗 Servidores conectados: ${c.guilds.cache.size}`);
  initializeSupportTimeouts(c).catch((err) =>
    console.error('[SupportTimeout] Erro ao carregar prazos:', err)
  );
  initializeVoiceXp(c).catch((err) =>
    console.error('[VoiceXP] Erro ao preparar cargos de call:', err)
  );
  initializeChatXp(c).catch((err) =>
    console.error('[ChatXP] Erro ao preparar cargos de chat:', err)
  );
  connectGameDatabase().catch((error: unknown) => {
    const errorName = error instanceof Error ? error.name : 'Erro desconhecido';
    console.error(`[GameDB] Não foi possível conectar ao banco (${errorName}); detalhe omitido por segurança.`);
  });
  initializeAntispamChannel(c).catch((error: unknown) => {
    const errorName = error instanceof Error ? error.name : 'Erro desconhecido';
    console.error(`[Antispam] Inicialização falhou (${errorName}); confira as permissões do bot.`);
  });
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  handleVoiceStateUpdate(oldState, newState);
  handleVoiceXpStateUpdate(oldState, newState).catch((err) =>
    console.error('[VoiceXP] Erro ao atualizar tempo de call:', err)
  );
});
client.on(Events.MessageCreate, (message: Message) => {
  handleSupportMessage(message);
  handleChatXpMessage(message).catch((err) =>
    console.error('[ChatXP] Erro ao atualizar XP de chat:', err)
  );
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
        case 'sugerir':       await handleSuggestion(interaction, SUGGESTIONS_CHANNEL_ID); break;
        case 'roleta':        await handleRoulette(interaction);     break;
        case 'tempo-suporte': await handleSupportTimeout(interaction); break;
        case 'ranking':
        case 'xp': {
          if (interaction.channelId !== XP_COMMAND_CHANNEL_ID) {
            await interaction.reply({
              content: 'Use este comando somente no canal de XP e ranking: <#1525234699038101564>.',
              flags: MessageFlags.Ephemeral,
            });
            break;
          }

          if (interaction.commandName === 'ranking') {
            await handleRanking(interaction);
          } else {
            await handleXp(interaction);
          }
          break;
        }
        case 'cartas':
          await handleCardGameCommand(interaction);
          break;
        case 'user': {
          const subcommand = interaction.options.getSubcommand();
          if (subcommand === 'avatar') await handleUserAvatar(interaction);
          if (subcommand === 'info') await handleUserInfo(interaction);
          break;
        }
        case 'ticket': {
          const subcommand = interaction.options.getSubcommand();
          if (subcommand === 'alert') await handleTicketAlert(interaction);
          if (subcommand === 'rank') await handleTicketRank(interaction);
          if (subcommand === 'voice') await handleTicketVoice(interaction);
          break;
        }
      }
      return;
    }

    // ── Modais ────────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('sorteio_')) {
        await handleSorteioModal(interaction);
      } else if (interaction.customId.startsWith('editar_')) {
        await handleEditarModal(interaction);
      } else if (interaction.customId === 'create_call_modal') {
        await handleCreateCallModal(interaction);
      } else if (interaction.customId === 'roleta_opcoes') {
        await handleRouletteModal(interaction);
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
      if (await handleCardGameButton(interaction)) {
        return;
      }

      if (await handleRouletteButton(interaction)) {
        return;
      }

      if (await handleMatchmakingButton(interaction)) {
        return;
      }

      if (interaction.customId === 'ticket_close') {
        await handleTicketClose(interaction);
      } else if (interaction.customId === 'ticket_voice') {
        await handleTicketVoiceButton(interaction);
      } else if (interaction.customId === 'criar_call') {
        await handleCreateCallButton(interaction);
      } else if (interaction.customId === 'feedback_sim' || interaction.customId === 'feedback_nao') {
        const msgId  = interaction.message.id;
        const userId = interaction.user.id;
        const isSim  = interaction.customId === 'feedback_sim';

        // Inicializa contadores para esta mensagem
        if (!voteData.has(msgId)) voteData.set(msgId, { sim: 0, nao: 0, voters: new Set() });
        const data = voteData.get(msgId)!;

        if (data.voters.has(userId)) {
          await interaction.reply({ content: 'Você já votou!', flags: MessageFlags.Ephemeral });
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
        .reply({ content: '❌ Ocorreu um erro ao processar a interação.', flags: MessageFlags.Ephemeral })
        .catch(() => null);
    }
  }
});

// ── Trava de instância única ────────────────────────────────────────────────
// Se já existe outra instância deste bot online (detectado via MongoDB),
// esta instância se desliga sozinha, pra nunca ter dois bots ativos ao mesmo tempo.
const SINGLETON_INSTANCE_ID = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const SINGLETON_STALE_MS = 20_000; // se a outra instância não der sinal de vida há 20s, considera ela morta

async function tryAcquireSingletonLock(): Promise<boolean> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[Startup] MONGODB_URI não configurado — não é possível checar instâncias duplicadas.');
    return true; // sem Mongo não dá pra verificar; segue normal
  }
  try {
    const mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    const collection = mongoClient.db('petdogg').collection<{
      _id: string;
      instanceId?: string;
      lastHeartbeat?: number;
      startedAt?: number;
    }>('bot_lock');
    const now = Date.now();
    const existing = await collection.findOne({ _id: 'singleton' });
    if (existing && typeof existing.lastHeartbeat === 'number' && now - existing.lastHeartbeat < SINGLETON_STALE_MS) {
      await mongoClient.close();
      return false; // outra instância ativa agora
    }
    await collection.updateOne(
      { _id: 'singleton' },
      { $set: { instanceId: SINGLETON_INSTANCE_ID, lastHeartbeat: now, startedAt: now } },
      { upsert: true },
    );
    // renova o "sinal de vida" a cada 10s enquanto este processo estiver rodando
    setInterval(() => {
      collection.updateOne(
        { _id: 'singleton', instanceId: SINGLETON_INSTANCE_ID },
        { $set: { lastHeartbeat: Date.now() } },
      ).catch((err) => console.error('[Startup] Erro ao renovar heartbeat da instância:', err));
    }, 10_000);
    return true;
  } catch (err) {
    console.error('[Startup] Erro ao checar instância única; seguindo mesmo assim:', err);
    return true;
  }
}

async function startBot(): Promise<void> {
  await loadConfig();
  const acquiredLock = await tryAcquireSingletonLock();
  if (!acquiredLock) {
    console.error(
      '[Startup] Outra instância deste bot já está rodando agora (detectado via MongoDB). ' +
      'Encerrando esta instância para evitar duplicação de mensagens, XP e banimentos.',
    );
    process.exit(0);
  }
  await client.login(token);
}

void startBot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`[Startup] Não foi possível iniciar o bot: ${message}`);
  process.exit(1);
});
