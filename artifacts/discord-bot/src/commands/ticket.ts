import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CategoryChannel,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
} from 'discord.js';

// ─── Configuração ─────────────────────────────────────────────────────────────

/** Canal onde o painel de tickets fica fixo */
const PANEL_CHANNEL_ID = '1505935902759977000';

/**
 * Cargos que podem ver e responder qualquer ticket.
 * Mesmos cargos de staff já usados no /sorteio.
 */
const STAFF_ROLE_IDS = [
  '1503440562211127316', // ♛ 𝑺𝒖𝒑𝒓𝒆𝒎𝒂 ♛
  '1481792319328878713', // 🜲 Thᥱ G᥆ᥲt᥉ 🜲
  '1502148024325898463', // .𖹭. 𝑬𝒒𝒖𝒊𝒑𝒆 𝒅𝒆 𝒔𝒖𝒑𝒐𝒓𝒕𝒆
  '1520888304835493888', // ⋆ 𝑪𝒐𝒐𝒓𝒅. 𝒅𝒆 𝑺𝒖𝒑𝒐𝒓𝒕𝒆 ⋆
];

/**
 * URL do GIF de cocô fofo com careta triste.
 * Troque por qualquer URL de imagem/GIF direto se quiser personalizar.
 */
const POOP_GIF_URL =
  'https://media.tenor.com/LCBfnMGLV6UAAAAC/sad-poop-emoji.gif';

const TICKET_TYPES = {
  ticket_suporte: {
    label: 'Suporte',
    emoji: '🛠️',
    color: 0x5865F2,        // blurple Discord
    description: 'suporte técnico ou ajuda geral',
  },
  ticket_duvidas: {
    label: 'Dúvidas',
    emoji: '❓',
    color: 0xFEE75C,        // amarelo
    description: 'esclarecer dúvidas',
  },
  ticket_parcerias: {
    label: 'Parcerias',
    emoji: '🤝',
    color: 0x57F287,        // verde
    description: 'proposta de parceria',
  },
} as const;

type TicketTypeKey = keyof typeof TICKET_TYPES;

// ─── Painel ───────────────────────────────────────────────────────────────────

/** Monta o embed + select menu do painel e envia no canal de tickets. */
async function sendPanel(channel: TextChannel): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('Suporte')
    .setDescription(
      '💬 **Fale com a gente!**\n' +
      'Se você está com alguma dúvida, precisa de ajuda ou quer conversar sobre uma possível parceria, estamos aqui pra você! 🤝✨\n\n' +
      '📩 Abra um ticket e explique direitinho o que você precisa — nossa equipe vai te responder o mais rápido possível e te dar todo o suporte necessário. 🚀\n\n' +
      '🛠️ Seja suporte técnico, dúvidas gerais ou propostas de parceria, pode contar com a gente! Não tenha vergonha de chamar, estamos sempre prontos pra ajudar. 💙'
    )
    .setColor(0x5865F2)
    .setImage(POOP_GIF_URL)
    .setFooter({ text: '🐾 Pet do GG • Sistema de Tickets' });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket_select')
    .setPlaceholder('Selecione uma opção')
    .addOptions([
      {
        label: 'Suporte',
        description: 'Abrir um ticket de suporte',
        value: 'ticket_suporte',
        emoji: '🛠️',
      },
      {
        label: 'Dúvidas',
        description: 'Abrir um ticket de dúvidas',
        value: 'ticket_duvidas',
        emoji: '❓',
      },
      {
        label: 'Parcerias',
        description: 'Abrir um ticket de parcerias',
        value: 'ticket_parcerias',
        emoji: '🤝',
      },
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  await channel.send({ embeds: [embed], components: [row] });
}

// ─── Handlers exportados ──────────────────────────────────────────────────────

/**
 * `/ticket-painel` — envia (ou reenvia) o painel de tickets.
 * Só deve ser usado por quem tem permissão de administrador.
 */
export async function handleTicketSetup(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  ) {
    await interaction.reply({
      content: '❌ Apenas administradores podem usar este comando.',
      ephemeral: true,
    });
    return;
  }

  const panelChannel = await interaction.guild!.channels
    .fetch(PANEL_CHANNEL_ID)
    .catch(() => null);

  if (!panelChannel || !panelChannel.isTextBased()) {
    await interaction.reply({
      content: `❌ Canal de tickets (<#${PANEL_CHANNEL_ID}>) não encontrado ou inacessível.`,
      ephemeral: true,
    });
    return;
  }

  await sendPanel(panelChannel as TextChannel);
  await interaction.reply({
    content: `✅ Painel de tickets enviado em <#${PANEL_CHANNEL_ID}>!`,
    ephemeral: true,
  });
}

/**
 * Disparado quando o usuário escolhe uma opção no select menu do painel.
 * Cria um canal privado de ticket para o usuário.
 */
export async function handleTicketSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const typeKey = interaction.values[0] as TicketTypeKey;
  const typeInfo = TICKET_TYPES[typeKey];

  if (!typeInfo) {
    await interaction.reply({ content: '❌ Opção inválida.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild!;
  const user  = interaction.user;

  // Impede duplicata: verifica se já existe um canal de ticket aberto para este usuário
  const existing = guild.channels.cache.find(
    (ch) =>
      ch.isTextBased() &&
      ch.name === slugName(typeInfo.label, user.username)
  );
  if (existing) {
    await interaction.editReply({
      content: `❌ Você já tem um ticket de ${typeInfo.label} aberto! <#${existing.id}>`,
    });
    return;
  }

  // Tenta encontrar uma categoria chamada "Tickets" para organizar os canais
  const category = guild.channels.cache.find(
    (ch): ch is CategoryChannel =>
      ch.type === ChannelType.GuildCategory &&
      ch.name.toLowerCase().includes('ticket')
  ) ?? null;

  // Cria o canal privado
  const ticketChannel = await guild.channels.create({
    name: slugName(typeInfo.label, user.username),
    type: ChannelType.GuildText,
    parent: category?.id ?? null,
    topic: `Ticket de ${typeInfo.label} aberto por ${user.tag}`,
    permissionOverwrites: [
      // @everyone: sem acesso
      {
        id: guild.roles.everyone,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      // Quem abriu: pode ver e escrever
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      // Cargos de staff: acesso total ao ticket
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

  // Embed inicial dentro do ticket
  const openEmbed = new EmbedBuilder()
    .setTitle(`${typeInfo.emoji} Ticket de ${typeInfo.label}`)
    .setDescription(
      `Olá, <@${user.id}>! 👋\n\n` +
      `Obrigado por abrir um ticket de **${typeInfo.description}**.\n` +
      `Nossa equipe irá te atender em breve — pode descrever sua situação aqui! 💙\n\n` +
      `> Use o botão abaixo para **fechar o ticket** quando tudo estiver resolvido.`
    )
    .setColor(typeInfo.color)
    .setFooter({ text: `🐾 Pet do GG • ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` });

  const closeBtn = new ButtonBuilder()
    .setCustomId('ticket_close')
    .setLabel('🔒 Fechar Ticket')
    .setStyle(ButtonStyle.Danger);

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(closeBtn);

  await ticketChannel.send({
    content: `<@${user.id}> ${STAFF_ROLE_IDS.map((id) => `<@&${id}>`).join(' ')}`,
    embeds: [openEmbed],
    components: [btnRow],
  });

  await interaction.editReply({
    content: `✅ Ticket criado com sucesso! <#${ticketChannel.id}>`,
  });

  console.log(`[Ticket] Aberto por ${user.tag} — tipo: ${typeInfo.label} — canal: ${ticketChannel.id}`);
}

/**
 * Disparado quando alguém clica em "🔒 Fechar Ticket".
 * Qualquer pessoa que veja o canal pode fechar (usuário ou staff).
 */
export async function handleTicketClose(
  interaction: ButtonInteraction
): Promise<void> {
  const channel = interaction.channel as TextChannel;

  const confirmEmbed = new EmbedBuilder()
    .setDescription(`🔒 Ticket fechado por <@${interaction.user.id}>.\nO canal será excluído em **5 segundos**.`)
    .setColor(0xED4245); // vermelho Discord

  await interaction.reply({ embeds: [confirmEmbed] });

  setTimeout(async () => {
    await channel.delete(`Ticket fechado por ${interaction.user.tag}`).catch(() => null);
  }, 5_000);

  console.log(`[Ticket] Fechado por ${interaction.user.tag} — canal: ${channel.id}`);
}

// ─── Utilitário ───────────────────────────────────────────────────────────────

/** Gera o nome do canal: ticket-suporte-username (só letras/números/hífen, max 100 chars) */
function slugName(label: string, username: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  return `ticket-${clean(label)}-${clean(username)}`.slice(0, 100);
}
