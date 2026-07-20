import {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';

import { SORTEIO_CHANNEL_ID, interactionHasStaffRole } from '../constants.js';

const BRAND_COLOR = 0x5865F2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseList(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

// ─── Validação de acesso ──────────────────────────────────────────────────────

async function checkAccess(
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  if (interaction.channelId !== SORTEIO_CHANNEL_ID) {
    await interaction.reply({
      content: `Este comando só pode ser usado em <#${SORTEIO_CHANNEL_ID}>.`,
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  if (!interactionHasStaffRole(interaction.member as Parameters<typeof interactionHasStaffRole>[0])) {
    await interaction.reply({
      content: 'Você não tem permissão para usar este comando.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  return true;
}

// ─── Embed: Por Função ────────────────────────────────────────────────────────

function buildFuncoesEmbed(
  tank: string[],
  dano: string[],
  suporte: string[]
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('Sorteio Overwatch — Por Função')
    .addFields(
      {
        name: '🛡️ Tank',
        value: tank.map((n) => `**${n}**`).join('\n'),
        inline: false,
      },
      {
        name: '⚔️ Dano',
        value: dano.map((n) => `**${n}**`).join('\n'),
        inline: false,
      },
      {
        name: '❤️ Suporte',
        value: suporte.map((n) => `**${n}**`).join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: 'Pet do GG · Sorteio Overwatch' })
    .setTimestamp();
}

// ─── Embed: Simples ───────────────────────────────────────────────────────────

function buildSimplesEmbed(sorteados: string[], quantidade: number): EmbedBuilder {
  const numbered = sorteados.map((n, i) => `\`${i + 1}.\` **${n}**`).join('\n');

  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`Sorteio — ${quantidade} jogador${quantidade !== 1 ? 'es' : ''}`)
    .addFields({
      name: 'Jogadores sorteados',
      value: numbered,
      inline: false,
    })
    .setFooter({ text: 'Pet do GG · Sorteio Overwatch' })
    .setTimestamp();
}

// ─── Comando /sorteio ─────────────────────────────────────────────────────────

export async function handleSorteio(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const allowed = await checkAccess(interaction);
  if (!allowed) return;

  const modo = interaction.options.getString('modo', true);

  if (modo === 'funcoes') {
    const modal = new ModalBuilder()
      .setCustomId('sorteio_funcoes')
      .setTitle('Sorteio Overwatch — Por Função');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('tanque')
          .setLabel('Tanques (um por linha ou vírgula)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Nome1\nNome2\nNome3')
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('dano')
          .setLabel('Dano (um por linha ou vírgula)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Nome1\nNome2\nNome3')
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('suporte')
          .setLabel('Suporte (um por linha ou vírgula)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Nome1\nNome2')
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
    return;
  }

  if (modo === 'simples') {
    const quantidade = Math.min(
      Math.max(interaction.options.getInteger('quantidade') ?? 5, 1),
      100
    );

    const modal = new ModalBuilder()
      .setCustomId(`sorteio_simples_${quantidade}`)
      .setTitle(`Sorteio — ${quantidade} jogador${quantidade !== 1 ? 'es' : ''}`);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('lista')
          .setLabel(`Lista de jogadores (sorteia ${quantidade})`)
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Nome1\nNome2\nNome3\n...')
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
    return;
  }
}

// ─── Submit do modal ──────────────────────────────────────────────────────────

export async function handleSorteioModal(
  interaction: ModalSubmitInteraction
): Promise<void> {
  await interaction.deferReply();

  // ── Por função ────────────────────────────────────────────────────────────
  if (interaction.customId === 'sorteio_funcoes') {
    const tanques  = parseList(interaction.fields.getTextInputValue('tanque'));
    const danos    = parseList(interaction.fields.getTextInputValue('dano'));
    const suportes = parseList(interaction.fields.getTextInputValue('suporte'));

    const erros: string[] = [];
    if (tanques.length  < 1) erros.push('**Tank** precisa de ao menos 1 jogador.');
    if (danos.length    < 2) erros.push('**Dano** precisa de ao menos 2 jogadores.');
    if (suportes.length < 2) erros.push('**Suporte** precisa de ao menos 2 jogadores.');

    if (erros.length > 0) {
      await interaction.editReply({
        content: `Não foi possível sortear:\n${erros.map((e) => `• ${e}`).join('\n')}`,
      });
      return;
    }

    const embed = buildFuncoesEmbed(
      pick(tanques, 1),
      pick(danos, 2),
      pick(suportes, 2)
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── Simples ───────────────────────────────────────────────────────────────
  if (interaction.customId.startsWith('sorteio_simples_')) {
    const rawQtd = interaction.customId.replace('sorteio_simples_', '');
    const quantidade = parseInt(rawQtd, 10) || 5;
    const lista = parseList(interaction.fields.getTextInputValue('lista'));

    if (lista.length < quantidade) {
      await interaction.editReply({
        content:
          `A lista precisa ter ao menos **${quantidade} jogador${quantidade !== 1 ? 'es' : ''}** para este sorteio. ` +
          `Você enviou ${lista.length}.`,
      });
      return;
    }

    const embed = buildSimplesEmbed(pick(lista, quantidade), quantidade);
    await interaction.editReply({ embeds: [embed] });
    return;
  }
}
