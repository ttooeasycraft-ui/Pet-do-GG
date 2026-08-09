import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CategoryChannel,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  StringSelectMenuInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import {
  interactionHasStaffRole,
  STAFF_ROLE_IDS,
  TICKET_NOTIFY_ROLE_IDS,
  TICKET_PANEL_CHANNEL_ID,
  VOICE_PANEL_CHANNEL_ID,
} from '../constants.js';
import {
  getConfig,
  getTicketRanking,
  getTicketRateLimit,
  recordTicketClosed,
  recordTicketOpened,
  setTicketPanelMessage,
} from '../config.js';
import { buildPanelEmbed, buildPanelMenu } from './editar.js';
import { trackGeneralCall } from '../events/voice.js';

const TICKET_TYPES = {
  ticket_suporte: { label: 'Suporte', color: 0x0099ff, description: 'suporte técnico ou ajuda geral' },
  ticket_duvidas: { label: 'Dúvidas', color: 0x0099ff, description: 'esclarecer dúvidas' },
  ticket_parcerias: { label: 'Parcerias', color: 0x0099ff, description: 'proposta de parceria' },
} as const;

type TicketTypeKey = keyof typeof TICKET_TYPES;

function formatDuration(milliseconds: number): string {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining ? `${hours}h ${remaining}min` : `${hours}h`;
  }
  return `${minutes}min`;
}

function isTicketChannel(channel: unknown): channel is TextChannel {
  return Boolean(
    channel instanceof TextChannel && channel.topic?.startsWith('Ticket de ')
  );
}

function ticketOwnerId(channel: TextChannel): string | null {
  const match = channel.topic?.match(
    /—\s*(\d{17,20})(?:\s+—\s+voice:\d{17,20})?$/
  );
  if (match) return match[1];

  const memberOverwrite = channel.permissionOverwrites.cache.find(
    (overwrite) =>
      overwrite.type === 1 &&
      !STAFF_ROLE_IDS.includes(overwrite.id) &&
      overwrite.id !== channel.client.user.id
  );
  return memberOverwrite?.id ?? null;
}

function ticketVoiceId(channel: TextChannel): string | null {
  return channel.topic?.match(/(?:^|\s|—)voice:(\d{17,20})(?:\s|$)/)?.[1] ?? null;
}

async function setTicketVoiceId(
  channel: TextChannel,
  voiceId: string | null,
): Promise<void> {
  const topicWithoutVoice = (channel.topic ?? '')
    .replace(/\s+—\s+voice:\d{17,20}\s*$/, '')
    .trim();
  const nextTopic = voiceId
    ? `${topicWithoutVoice} — voice:${voiceId}`
    : topicWithoutVoice;
  await channel.setTopic(nextTopic);
}

async function deleteTicketVoice(
  guild: TextChannel['guild'],
  voiceId: string | null,
): Promise<void> {
  if (!voiceId) return;

  const voice = await guild.channels.fetch(voiceId).catch(() => null);
  if (!voice) return;

  await voice.delete('Call de ticket exclu junto com o ticket');
  console.log(`[Ticket] Call vinculada excluída — ${voiceId}`);
}

function staffOnly(interaction: ChatInputCommandInteraction): boolean {
  return interactionHasStaffRole(
    interaction.member as Parameters<typeof interactionHasStaffRole>[0]
  );
}

export async function handleTicketSetup(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'Apenas administradores podem usar este comando.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const panelChannel = await interaction.guild!.channels
    .fetch(TICKET_PANEL_CHANNEL_ID)
    .catch(() => null);

  if (!panelChannel?.isTextBased()) {
    await interaction.reply({
      content: `Canal de tickets (<#${TICKET_PANEL_CHANNEL_ID}>) não encontrado ou inacessível.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const config = getConfig();
  const msg = await sendPanel(
    panelChannel as TextChannel,
    config.ticket.panelText,
    config.ticket.panelImageUrl
  );
  setTicketPanelMessage(msg.id, TICKET_PANEL_CHANNEL_ID);

  await interaction.reply({
    content: `Painel enviado em <#${TICKET_PANEL_CHANNEL_ID}>.`,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleTicketSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const typeKey = interaction.values[0] as TicketTypeKey;
  const typeInfo = TICKET_TYPES[typeKey];

  if (!typeInfo) {
    await interaction.reply({
      content: 'Opção inválida.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const remaining = getTicketRateLimit(interaction.user.id);
  if (remaining > 0) {
    await interaction.reply({
      content: `Você atingiu o limite de tickets. Tente novamente em ${formatDuration(remaining)}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild!;
  const user = interaction.user;
  const channelName = slugName(typeInfo.label, user.username);
  const existing = guild.channels.cache.find(
    (channel) => channel.isTextBased() && channel.name === channelName
  );

  if (existing) {
    await interaction.editReply({
      content: `Você já tem um ticket de ${typeInfo.label} aberto: <#${existing.id}>`,
    });
    return;
  }

  const category = guild.channels.cache.find(
    (channel): channel is CategoryChannel =>
      channel.type === ChannelType.GuildCategory &&
      channel.name.toLowerCase().includes('ticket')
  ) ?? null;

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category?.id ?? null,
    topic: `Ticket de ${typeInfo.label} — ${user.username} — ${user.id}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      ...STAFF_ROLE_IDS.map((roleId) => ({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ManageMessages,
        ],
      })),
    ],
  });

  const openEmbed = new EmbedBuilder()
    .setTitle(`Ticket — ${typeInfo.label}`)
    .setDescription(
      `Olá, <@${user.id}>!\n\n` +
      `Você abriu um ticket de **${typeInfo.description}**.\n` +
      'Nossa equipe vai te atender em breve. Descreva sua situação aqui.\n\n' +
      'Use o botão abaixo para fechar o ticket quando tudo estiver resolvido.'
    )
    .setColor(typeInfo.color)
    .setFooter({
      text: `Pet do GG · ${new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      })}`,
    });

  const closeButton = new ButtonBuilder()
    .setCustomId('ticket_close')
    .setLabel('Fechar ticket')
    .setStyle(ButtonStyle.Danger);
  const voiceButton = new ButtonBuilder()
    .setCustomId('ticket_voice')
    .setLabel('Criar call')
    .setStyle(ButtonStyle.Primary);

  await ticketChannel.send({
    content: `<@${user.id}> ${TICKET_NOTIFY_ROLE_IDS.map((id) => `<@&${id}>`).join(' ')}`,
    embeds: [openEmbed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton, voiceButton),
    ],
  });

  recordTicketOpened(user.id);
  await interaction.editReply({
    content: `Ticket criado! <#${ticketChannel.id}>`,
  });

  console.log(`[Ticket] Aberto por ${user.username} — tipo: ${typeInfo.label} — canal: ${ticketChannel.id}`);
}

export async function handleTicketAlert(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const channel = interaction.channel;
  if (!isTicketChannel(channel)) {
    await interaction.reply({
      content: 'Use este comando dentro do canal de um ticket.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!staffOnly(interaction)) {
    await interaction.reply({
      content: 'Apenas a equipe de suporte pode enviar alertas de ticket.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const ownerId = ticketOwnerId(channel);
  await interaction.reply({
    content: ownerId
      ? `<@${ownerId}>, a equipe está aguardando sua resposta neste atendimento.`
      : 'A equipe está aguardando uma resposta neste atendimento.',
  });
}

export async function handleTicketRank(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!staffOnly(interaction)) {
    await interaction.reply({
      content: 'Apenas a equipe de suporte pode consultar o ranking.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const ranking = getTicketRanking();
  const description = ranking.length
    ? ranking
        .map(
          (entry, index) =>
            `**${index + 1}.** <@${entry.userId}> — ${entry.total} registro(s) ` +
            `(${entry.opened} aberto(s), ${entry.closed} fechado(s))`
        )
        .join('\n')
    : 'Ainda não há registros de tickets.';

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('Ranking de tickets')
        .setDescription(description)
        .setColor(0x0099ff)
        .setFooter({ text: 'Pet do GG · suporte' }),
    ],
  });
}

export async function handleTicketVoice(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const channel = interaction.channel;
  if (!isTicketChannel(channel)) {
    await interaction.reply({
      content: 'Use este comando dentro do canal de um ticket.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!staffOnly(interaction)) {
    await interaction.reply({
      content: 'Apenas a equipe de suporte pode criar a call pelo comando.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await createTicketVoice(interaction, channel);
}

export async function handleTicketClose(
  interaction: ButtonInteraction
): Promise<void> {
  const channel = interaction.channel;
  const ownerId = channel instanceof TextChannel ? ticketOwnerId(channel) : null;
  const voiceId = channel instanceof TextChannel ? ticketVoiceId(channel) : null;

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setDescription(
          `Ticket fechado por <@${interaction.user.id}>.\nO canal será excluído em **5 segundos**.`
        )
        .setColor(0xED4245),
    ],
  });

  if (channel instanceof TextChannel) {
    await deleteTicketVoice(channel.guild, voiceId).catch((error) => {
      console.error(`[Ticket] Erro ao excluir a call vinculada ${voiceId}:`, error);
    });
    if (voiceId) {
      await setTicketVoiceId(channel, null).catch((error) => {
        console.error(`[Ticket] Erro ao limpar a referência da call ${voiceId}:`, error);
      });
    }
  }

  if (ownerId) recordTicketClosed(ownerId, interaction.user.id);
  setTimeout(async () => {
    await channel?.delete(`Ticket fechado por ${interaction.user.username}`).catch(() => null);
  }, 5_000);
}

export async function handleTicketVoiceButton(
  interaction: ButtonInteraction
): Promise<void> {
  const channel = interaction.channel;
  if (!isTicketChannel(channel)) {
    await interaction.reply({
      content: 'Este botão só funciona dentro de um ticket.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await createTicketVoice(interaction, channel);
}

async function createTicketVoice(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  ticketChannel: TextChannel,
): Promise<void> {
  const existingVoiceId = ticketVoiceId(ticketChannel);
  if (existingVoiceId) {
    const existingVoice = await ticketChannel.guild.channels
      .fetch(existingVoiceId)
      .catch(() => null);
    if (existingVoice?.type === ChannelType.GuildVoice) {
      await interaction.reply({
        content: `Este ticket já possui uma call: <#${existingVoice.id}>`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await setTicketVoiceId(ticketChannel, null);
  }

  const guild = ticketChannel.guild;
  const ownerId = ticketOwnerId(ticketChannel);
  const staffOverwrites = STAFF_ROLE_IDS.map((roleId) => ({
    id: roleId,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.ManageChannels,
    ],
  }));
  const ownerOverwrite = ownerId
    ? [{
        id: ownerId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      }]
    : [];

  const voice = await guild.channels.create({
    name: 'Suporte Call',
    type: ChannelType.GuildVoice,
    parent: ticketChannel.parentId ?? undefined,
    userLimit: 0,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      ...ownerOverwrite,
      ...staffOverwrites,
    ],
  });

  try {
    await setTicketVoiceId(ticketChannel, voice.id);
  } catch (error) {
    await voice.delete('Não foi possível salvar o vínculo com o ticket').catch(() => null);
    throw error;
  }

  await interaction.reply({
    content: `Call criada: <#${voice.id}> (Suporte Call, sem limite)`,
    flags: MessageFlags.Ephemeral,
  });
}

async function sendPanel(
  channel: TextChannel,
  text: string,
  imageUrl: string
): Promise<Message> {
  return channel.send({
    embeds: [buildPanelEmbed(text, imageUrl)],
    components: [buildPanelMenu()],
  });
}

export async function handleCreateCallButton(
  interaction: ButtonInteraction
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('create_call_modal')
    .setTitle('Criar call de voz')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('nome')
          .setLabel('Nome')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex.: Call da equipe')
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('limite')
          .setLabel('Limite (0 = sem limite)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Deixe vazio ou use 0 para sem limite')
          .setRequired(false)
          .setMaxLength(2)
      )
    );
  await interaction.showModal(modal);
}

export async function handleCreateCallModal(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const name = interaction.fields.getTextInputValue('nome').trim();
  const rawLimit = interaction.fields.getTextInputValue('limite').trim();
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 0;
  if (!name || !Number.isFinite(limit) || limit < 0 || limit > 99) {
    await interaction.reply({
      content: 'Informe um nome válido e um limite entre 0 e 99.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const panel = await interaction.client.channels.fetch(VOICE_PANEL_CHANNEL_ID);
  if (!panel || !('guild' in panel) || !panel.guild) {
    await interaction.reply({
      content: 'Não encontrei a categoria das calls.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const voice = await panel.guild.channels.create({
    name: cleanChannelName(name),
    type: ChannelType.GuildVoice,
    parent: 'parentId' in panel ? panel.parentId ?? undefined : undefined,
    userLimit: limit,
  });
  trackGeneralCall(voice);

  await interaction.reply({
    content: `Call criada: <#${voice.id}>${limit ? ` (limite: ${limit})` : ' (sem limite)'}`,
    flags: MessageFlags.Ephemeral,
  });
}

export function buildCallPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('📞 Criar Call de Voz')
    .setDescription(
      'Clique no botão abaixo para criar uma call de voz personalizada. ' +
      'Se ninguém entrar em até 1 minuto, ela será excluída automaticamente; ' +
      'depois de usada, também será excluída quando ficar vazia.'
    )
    .setColor(0x0099ff);
}

export function buildCallPanelButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('criar_call')
      .setStyle(ButtonStyle.Primary)
      .setLabel('Criar call')
  );
}

function cleanChannelName(value: string): string {
  return value.trim().replace(/\s+/g, '-').slice(0, 100) || 'call';
}

function slugName(label: string, username: string): string {
  const clean = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  return `ticket-${clean(label)}-${clean(username)}`.slice(0, 100);
}