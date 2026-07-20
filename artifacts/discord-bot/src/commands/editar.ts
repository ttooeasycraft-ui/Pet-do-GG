/**
 * /editar-texto — permite à equipe editar os textos informativos do bot
 * diretamente pelo Discord, sem mexer no código.
 *
 * Seções editáveis:
 *   • boas-vindas    — texto e imagem/banner da mensagem de entrada de membros
 *   • painel-suporte — texto e imagem/GIF do painel de tickets
 *
 * Acesso: apenas cargos de staff (mesmos do /sorteio e tickets).
 */
import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { interactionHasStaffRole, TICKET_PANEL_CHANNEL_ID } from '../constants.js';
import {
  getConfig,
  setWelcome,
  setTicketPanelText,
} from '../config.js';

// ─── Slash command handler ────────────────────────────────────────────────────

export async function handleEditar(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interactionHasStaffRole(interaction.member as Parameters<typeof interactionHasStaffRole>[0])) {
    await interaction.reply({
      content: 'Você não tem permissão para usar este comando.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Nome da opção sem acento para evitar problemas de normalização Unicode
  const secao = interaction.options.getString('secao', true);
  const config = getConfig();

  if (secao === 'boas-vindas') {
    const modal = new ModalBuilder()
      .setCustomId('editar_boas_vindas')
      .setTitle('Editar — Boas-vindas');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('texto')
          .setLabel('Texto da mensagem')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(config.welcome.text)
          .setMaxLength(3000)
          .setPlaceholder(
            'Use {membro} para mencionar, {servidor} para o nome do servidor, {contagem} para o número de membros.'
          )
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('imagem')
          .setLabel('URL da imagem/banner (deixe vazio para remover)')
          .setStyle(TextInputStyle.Short)
          .setValue(config.welcome.imageUrl || ' ')
          .setMaxLength(512)
          .setRequired(false)
      )
    );

    await interaction.showModal(modal);
    return;
  }

  if (secao === 'painel-suporte') {
    const modal = new ModalBuilder()
      .setCustomId('editar_painel_suporte')
      .setTitle('Editar — Painel de Suporte');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('texto')
          .setLabel('Texto do painel de tickets')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(config.ticket.panelText)
          .setMaxLength(3000)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('imagem')
          .setLabel('URL da imagem/GIF (deixe vazio para remover)')
          .setStyle(TextInputStyle.Short)
          .setValue(config.ticket.panelImageUrl || ' ')
          .setMaxLength(512)
          .setRequired(false)
      )
    );

    await interaction.showModal(modal);
    return;
  }
}

// ─── Modal submit handler ─────────────────────────────────────────────────────

export async function handleEditarModal(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const texto = interaction.fields.getTextInputValue('texto').trim();

  // Campo imagem é opcional — trata ausência e valor vazio com segurança
  let imagem = '';
  try {
    imagem = interaction.fields.getTextInputValue('imagem').trim();
  } catch {
    imagem = '';
  }

  // ── Boas-vindas ─────────────────────────────────────────────────────────────
  if (interaction.customId === 'editar_boas_vindas') {
    setWelcome(texto, imagem);

    await interaction.reply({
      content:
        '✅ Texto de boas-vindas atualizado!\n' +
        'O próximo membro a entrar já vai receber a nova mensagem.\n\n' +
        '**Prévia:**\n' +
        `> ${texto.replace(/\n/g, '\n> ')}` +
        (imagem ? `\n\n🖼️ ${imagem}` : '\n\n_(sem imagem)_'),
      flags: MessageFlags.Ephemeral,
    });

    console.log(`[Editar] Boas-vindas atualizado por ${interaction.user.username}`);
    return;
  }

  // ── Painel de suporte ────────────────────────────────────────────────────────
  if (interaction.customId === 'editar_painel_suporte') {
    setTicketPanelText(texto, imagem);

    const config = getConfig();
    let editedLive = false;

    if (config.ticket.panelMessageId && config.ticket.panelChannelId) {
      try {
        const ch = await interaction.client.channels
          .fetch(config.ticket.panelChannelId)
          .catch(() => null);

        if (ch?.isTextBased()) {
          const msg = await (ch as TextChannel).messages
            .fetch(config.ticket.panelMessageId)
            .catch(() => null);

          if (msg?.editable) {
            const newEmbed = buildPanelEmbed(texto, imagem);
            const menuRow  = buildPanelMenu();
            await msg.edit({ embeds: [newEmbed], components: [menuRow] });
            editedLive = true;
          }
        }
      } catch (err) {
        console.error('[Editar] Erro ao editar mensagem do painel:', err);
      }
    }

    const liveNote = editedLive
      ? `Mensagem do painel em <#${TICKET_PANEL_CHANNEL_ID}> atualizada ao vivo.`
      : `Texto salvo. Use \`/ticket-painel\` para reenviar o painel com o novo texto.`;

    await interaction.reply({
      content:
        `✅ Painel de suporte atualizado!\n${liveNote}\n\n` +
        '**Prévia:**\n' +
        `> ${texto.replace(/\n/g, '\n> ')}` +
        (imagem ? `\n\n🖼️ ${imagem}` : '\n\n_(sem imagem)_'),
      flags: MessageFlags.Ephemeral,
    });

    console.log(`[Editar] Painel de suporte atualizado por ${interaction.user.username}`);
    return;
  }
}

// ─── Helpers (também usados em ticket.ts via re-exportação) ──────────────────

/** Constrói o embed do painel de tickets */
export function buildPanelEmbed(text: string, imageUrl: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('Suporte')
    .setDescription(text)
    .setColor(0x5865F2)
    .setFooter({ text: 'Pet do GG · Sistema de Tickets' });

  if (imageUrl) embed.setImage(imageUrl);
  return embed;
}

/** Constrói o select menu do painel de tickets */
export function buildPanelMenu(): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket_select')
    .setPlaceholder('Selecione uma opção')
    .addOptions([
      { label: 'Suporte',    description: 'Abrir um ticket de suporte',   value: 'ticket_suporte'    },
      { label: 'Dúvidas',   description: 'Abrir um ticket de dúvidas',   value: 'ticket_duvidas'   },
      { label: 'Parcerias', description: 'Abrir um ticket de parcerias', value: 'ticket_parcerias'  },
    ]);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}
