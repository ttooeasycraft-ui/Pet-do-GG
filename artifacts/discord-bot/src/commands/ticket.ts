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
  PermissionFlagsBits,
  StringSelectMenuInteraction,
  TextChannel,
} from 'discord.js';

import { STAFF_ROLE_IDS, TICKET_PANEL_CHANNEL_ID } from '../constants.js';
import { getConfig, setTicketPanelMessage } from '../config.js';
import { buildPanelEmbed, buildPanelMenu } from './editar.js';

// ─── Tipos de ticket ──────────────────────────────────────────────────────────

const TICKET_TYPES = {
  ticket_suporte:   { label: 'Suporte',   color: 0x5865F2, description: 'suporte técnico ou ajuda geral' },
  ticket_duvidas:   { label: 'Dúvidas',   color: 0x5865F2, description: 'esclarecer dúvidas' },
  ticket_parcerias: { label: 'Parcerias', color: 0x5865F2, description: 'proposta de parceria' },
} as const;

type TicketTypeKey = keyof typeof TICKET_TYPES;

// ─── Handlers exportados ──────────────────────────────────────────────────────

/**
 * `/ticket-painel` — envia (ou reenvia) o painel no canal configurado.
 * Só administradores podem usar. Salva o ID da mensagem para edições futuras.
 */
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
  const msg    = await sendPanel(panelChannel as TextChannel, config.ticket.panelText, config.ticket.panelImageUrl);

  setTicketPanelMessage(msg.id, TICKET_PANEL_CHANNEL_ID);

  await interaction.reply({
    content: `Painel enviado em <#${TICKET_PANEL_CHANNEL_ID}>.`,
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Disparado quando o usuário escolhe uma opção no select menu do painel.
 * Cria um canal privado de ticket.
 */
export async function handleTicketSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const typeKey  = interaction.values[0] as TicketTypeKey;
  const typeInfo = TICKET_TYPES[typeKey];

  if (!typeInfo) {
    await interaction.reply({ content: 'Opção inválida.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild!;
  const user  = interaction.user;

  // Verifica duplicata pelo nome do canal
  const channelName = slugName(typeInfo.label, user.username);
  const existing    = guild.channels.cache.find(
    (ch) => ch.isTextBased() && ch.name === channelName
  );
  if (existing) {
    await interaction.editReply({
      content: `Você já tem um ticket de ${typeInfo.label} aberto: <#${existing.id}>`,
    });
    return;
  }

  // Tenta encaixar numa categoria "ticket" existente
  const category = guild.channels.cache.find(
    (ch): ch is CategoryChannel =>
      ch.type === ChannelType.GuildCategory &&
      ch.name.toLowerCase().includes('ticket')
  ) ?? null;

  // Cria o canal privado
  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category?.id ?? null,
    topic: `Ticket de ${typeInfo.label} — ${user.username}`,
    permissionOverwrites: [
      { id: guild.roles.everyone,  deny: [PermissionFlagsBits.ViewChannel] },
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
      `Nossa equipe vai te atender em breve. Pode descrever sua situação aqui.\n\n` +
      `Use o botão abaixo para fechar o ticket quando tudo estiver resolvido.`
    )
    .setColor(typeInfo.color)
    .setFooter({ text: `Pet do GG · ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` });

  const closeBtn = new ButtonBuilder()
    .setCustomId('ticket_close')
    .setLabel('Fechar Ticket')
    .setStyle(ButtonStyle.Danger);

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(closeBtn);

  await ticketChannel.send({
    content: `<@${user.id}> ${STAFF_ROLE_IDS.map((id) => `<@&${id}>`).join(' ')}`,
    embeds:  [openEmbed],
    components: [btnRow],
  });

  await interaction.editReply({
    content: `Ticket criado! <#${ticketChannel.id}>`,
  });

  console.log(`[Ticket] Aberto por ${user.username} — tipo: ${typeInfo.label} — canal: ${ticketChannel.id}`);
}

/**
 * Disparado quando alguém clica em "Fechar Ticket".
 */
export async function handleTicketClose(
  interaction: ButtonInteraction
): Promise<void> {
  const channel = interaction.channel as TextChannel;

  const confirmEmbed = new EmbedBuilder()
    .setDescription(`Ticket fechado por <@${interaction.user.id}>.\nO canal será excluído em **5 segundos**.`)
    .setColor(0xED4245);

  await interaction.reply({ embeds: [confirmEmbed] });

  setTimeout(async () => {
    await channel.delete(`Ticket fechado por ${interaction.user.username}`).catch(() => null);
  }, 5_000);

  console.log(`[Ticket] Fechado por ${interaction.user.username} — canal: ${channel.id}`);
}

// ─── Interno ──────────────────────────────────────────────────────────────────

/** Envia o painel e retorna a mensagem criada (para salvar o ID) */
async function sendPanel(channel: TextChannel, text: string, imageUrl: string): Promise<Message> {
  const embed = buildPanelEmbed(text, imageUrl);
  const row   = buildPanelMenu();
  return channel.send({ embeds: [embed], components: [row] });
}

/** Nome do canal: ticket-suporte-username (ASCII, max 100 chars) */
function slugName(label: string, username: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  return `ticket-${clean(label)}-${clean(username)}`.slice(0, 100);
}
