import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { MATCHMAKING_TEST_CHANNEL_ID } from '../constants.js';

const MATCH_SIZES = ['1v1', '2v2', '3v3', '4v4', '5v5', '6v6'] as const;
type MatchSize = (typeof MATCH_SIZES)[number];

const ROLES = ['tank', 'damage', 'support'] as const;
type MatchRole = (typeof ROLES)[number];

interface MatchPreference {
  size?: MatchSize;
  role?: MatchRole;
}

interface QueueEntry {
  size: MatchSize;
  role: MatchRole;
  joinedAt: number;
}

const preferences = new Map<string, MatchPreference>();
const queue = new Map<string, QueueEntry>();

const roleLabels: Record<MatchRole, string> = {
  tank: 'Tank',
  damage: 'Dano',
  support: 'Suporte',
};

const sizeButton = (size: MatchSize): ButtonBuilder =>
  new ButtonBuilder()
    .setCustomId(`match_size_${size}`)
    .setLabel(size)
    .setStyle(ButtonStyle.Primary);

const roleButton = (role: MatchRole, label: string): ButtonBuilder =>
  new ButtonBuilder()
    .setCustomId(`match_role_${role}`)
    .setLabel(label)
    .setStyle(ButtonStyle.Success);

export function buildMatchmakingPanelComponents(): [
  ActionRowBuilder<ButtonBuilder>,
  ActionRowBuilder<ButtonBuilder>,
  ActionRowBuilder<ButtonBuilder>,
  ActionRowBuilder<ButtonBuilder>,
] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      sizeButton('1v1'),
      sizeButton('2v2'),
      sizeButton('3v3')
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      sizeButton('4v4'),
      sizeButton('5v5'),
      sizeButton('6v6')
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      roleButton('tank', '🛡️ Tank'),
      roleButton('damage', '⚔️ Dano'),
      roleButton('support', '💚 Suporte')
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('match_join_queue')
        .setLabel('✅ Entrar na fila')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('match_leave_queue')
        .setLabel('❌ Sair da fila')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('match_refresh_queue')
        .setLabel('🔄 Atualizar fila')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

export function buildMatchmakingPanelEmbed(): EmbedBuilder {
  const queueLines = MATCH_SIZES.map((size) => {
    const count = [...queue.values()].filter((entry) => entry.size === size).length;
    return `**${size}** — ${count} ${count === 1 ? 'jogador' : 'jogadores'}`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎮 Matchmaking Overwatch · teste')
    .setDescription(
      'Escolha o tamanho da partida e sua função. Depois, entre na fila para testar o fluxo.'
    )
    .addFields(
      {
        name: 'Como testar',
        value:
          '1. Clique em **1v1** até **6v6**.\n' +
          '2. Escolha **Tank**, **Dano** ou **Suporte**.\n' +
          '3. Clique em **Entrar na fila**.',
      },
      {
        name: 'Fila atual',
        value: queueLines,
        inline: true,
      },
      {
        name: 'Status',
        value:
          'Protótipo experimental. As escolhas e a fila funcionam apenas neste canal e ficam na memória enquanto o bot estiver online.',
        inline: true,
      }
    )
    .setFooter({ text: 'Teste privado · sem menções · diga o que precisa melhorar' });
}

function isMatchmakingButton(customId: string): boolean {
  return (
    customId.startsWith('match_size_') ||
    customId.startsWith('match_role_') ||
    customId === 'match_join_queue' ||
    customId === 'match_leave_queue' ||
    customId === 'match_refresh_queue'
  );
}

async function refreshPanel(interaction: ButtonInteraction): Promise<void> {
  await interaction.message.edit({
    embeds: [buildMatchmakingPanelEmbed()],
    components: buildMatchmakingPanelComponents(),
    content: '',
  });
}

export async function handleMatchmakingButton(
  interaction: ButtonInteraction
): Promise<boolean> {
  if (interaction.channelId !== MATCHMAKING_TEST_CHANNEL_ID) return false;
  if (!isMatchmakingButton(interaction.customId)) return false;

  const userId = interaction.user.id;
  const current = preferences.get(userId) ?? {};

  if (interaction.customId.startsWith('match_size_')) {
    const size = interaction.customId.replace('match_size_', '') as MatchSize;
    if (!MATCH_SIZES.includes(size)) return true;
    preferences.set(userId, { ...current, size });

    const queued = queue.get(userId);
    if (queued) queue.set(userId, { ...queued, size });

    await interaction.reply({
      content: `✅ Tamanho selecionado: **${size}**. Agora escolha sua função.`,
      flags: MessageFlags.Ephemeral,
    });
    if (queued) await refreshPanel(interaction);
    return true;
  }

  if (interaction.customId.startsWith('match_role_')) {
    const role = interaction.customId.replace('match_role_', '') as MatchRole;
    if (!ROLES.includes(role)) return true;
    preferences.set(userId, { ...current, role });

    const queued = queue.get(userId);
    if (queued) queue.set(userId, { ...queued, role });

    await interaction.reply({
      content: `✅ Função selecionada: **${roleLabels[role]}**. Agora você pode entrar na fila.`,
      flags: MessageFlags.Ephemeral,
    });
    if (queued) await refreshPanel(interaction);
    return true;
  }

  if (interaction.customId === 'match_join_queue') {
    const preference = preferences.get(userId);
    if (!preference?.size || !preference.role) {
      await interaction.reply({
        content:
          '⚠️ Antes de entrar, escolha um tamanho de partida e uma função.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    queue.set(userId, {
      size: preference.size,
      role: preference.role,
      joinedAt: Date.now(),
    });
    await refreshPanel(interaction);
    await interaction.reply({
      content:
        `✅ Você entrou na fila **${preference.size}** como **${roleLabels[preference.role]}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (interaction.customId === 'match_leave_queue') {
    const removed = queue.delete(userId);
    await refreshPanel(interaction);
    await interaction.reply({
      content: removed
        ? '✅ Você saiu da fila.'
        : 'ℹ️ Você não estava em uma fila.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  await refreshPanel(interaction);
  await interaction.reply({
    content: '🔄 Fila atualizada.',
    flags: MessageFlags.Ephemeral,
  });
  return true;
}