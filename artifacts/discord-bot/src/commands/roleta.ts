import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  interactionHasStaffRole,
  ROULETTE_TEST_CHANNEL_ID,
} from '../constants.js';

const MAX_OPTIONS = 30;
const SPIN_FRAMES = [
  '🔵 **Preparando a roleta...**',
  '🟣 **Girando...**  ◉  ◌  ◍  ◌',
  '🔵 **Girando...**  ◌  ◍  ◌  ◉',
  '🟣 **Girando...**  ◍  ◌  ◉  ◌',
  '🔵 **Quase parando...**  ◌  ◉  ◌  ◍',
];

interface RouletteState {
  options: string[];
  spinning: boolean;
}

const rouletteStates = new Map<string, RouletteState>();
type RouletteInteraction =
  | ChatInputCommandInteraction
  | ModalSubmitInteraction
  | ButtonInteraction;

function parseOptions(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((option) => option.trim())
    .filter(Boolean);
}

function canUseRoulette(
  interaction: RouletteInteraction
): boolean {
  if (interaction.channelId !== ROULETTE_TEST_CHANNEL_ID) return false;

  const member = interaction.member as Parameters<typeof interactionHasStaffRole>[0];
  const isOwner = interaction.guild?.ownerId === interaction.user.id;
  return isOwner || interactionHasStaffRole(member);
}

async function rejectOutsideTest(
  interaction: RouletteInteraction
): Promise<void> {
  await interaction.reply({
    content:
      `Esse protótipo só pode ser usado no canal de teste <#${ROULETTE_TEST_CHANNEL_ID}> ` +
      'e pela equipe autorizada.',
    flags: MessageFlags.Ephemeral,
  });
}

function buildRouletteComponents(): [
  ActionRowBuilder<ButtonBuilder>,
] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('roleta_girar')
        .setLabel('🎡 Girar roleta')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('roleta_nova')
        .setLabel('➕ Criar outra')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function buildRouletteEmbed(
  options: string[],
  status = 'Clique em **Girar roleta** para sortear uma opção.'
): EmbedBuilder {
  const optionList = options
    .map((option, index) => `\`${String(index + 1).padStart(2, '0')}\` ${option}`)
    .join('\n');

  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle('🎡 Roleta · protótipo de teste')
    .setDescription(
      `${status}\n\n**Opções cadastradas (${options.length}/${MAX_OPTIONS}):**\n${optionList}`
    )
    .setFooter({
      text: 'Versão não oficial · teste de animação · Pet do GG',
    });
}

function buildResultEmbed(
  options: string[],
  result: string,
  status: string
): EmbedBuilder {
  return buildRouletteEmbed(
    options,
    `${status}\n\n🎉 **Resultado:**\n# ${result}`
  );
}

function buildOptionsModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('roleta_opcoes')
    .setTitle('Criar roleta de teste')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('opcoes')
          .setLabel('Opções da roleta (uma por linha)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Opção 1\nOpção 2\nOpção 3\n... até 30 opções')
          .setMaxLength(2000)
          .setRequired(true)
      )
    );
}

export async function handleRoulette(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!canUseRoulette(interaction)) {
    await rejectOutsideTest(interaction);
    return;
  }

  await interaction.showModal(buildOptionsModal());
}

export async function handleRouletteModal(
  interaction: ModalSubmitInteraction
): Promise<void> {
  if (!canUseRoulette(interaction)) {
    await rejectOutsideTest(interaction);
    return;
  }

  const options = parseOptions(interaction.fields.getTextInputValue('opcoes'));
  if (options.length === 0) {
    await interaction.reply({
      content: 'Digite pelo menos uma opção para criar a roleta.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (options.length > MAX_OPTIONS) {
    await interaction.reply({
      content: `A roleta de teste aceita no máximo **${MAX_OPTIONS} opções**.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!(interaction.channel instanceof TextChannel)) {
    await interaction.reply({
      content: 'Não consegui encontrar o canal de teste.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const message = await interaction.channel.send({
    embeds: [buildRouletteEmbed(options)],
    components: buildRouletteComponents(),
  });
  rouletteStates.set(message.id, { options, spinning: false });

  await interaction.reply({
    content: '✅ Protótipo criado neste canal. Agora é só clicar em **Girar roleta**.',
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleRouletteButton(
  interaction: ButtonInteraction
): Promise<boolean> {
  if (!interaction.customId.startsWith('roleta_')) return false;
  if (!canUseRoulette(interaction)) {
    await rejectOutsideTest(interaction);
    return true;
  }

  if (interaction.customId === 'roleta_nova') {
    await interaction.showModal(buildOptionsModal());
    return true;
  }

  const state = rouletteStates.get(interaction.message.id);
  if (!state) {
    await interaction.reply({
      content:
        'Essa roleta expirou porque o bot foi reiniciado. Use `/roleta` para criar uma nova.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (state.spinning) {
    await interaction.reply({
      content: 'A roleta já está girando. Espere o resultado aparecer.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  state.spinning = true;
  await interaction.deferUpdate();

  try {
    for (const frame of SPIN_FRAMES) {
      await interaction.message.edit({
        embeds: [buildRouletteEmbed(state.options, frame)],
        components: buildRouletteComponents(),
      });
      await new Promise((resolve) => setTimeout(resolve, 450));
    }

    const result =
      state.options[Math.floor(Math.random() * state.options.length)];
    await interaction.message.edit({
      embeds: [
        buildResultEmbed(state.options, result, '✅ A roleta parou!'),
      ],
      components: buildRouletteComponents(),
    });
  } finally {
    state.spinning = false;
  }

  return true;
}