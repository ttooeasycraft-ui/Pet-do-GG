import {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';

// ─── Configuração de acesso ───────────────────────────────────────────────────

const SORTEIO_CHANNEL_ID = '1524833320658141394';

const ALLOWED_ROLE_IDS = [
  '1503440562211127316', // ♛ 𝑺𝒖𝒑𝒓𝒆𝒎𝒂 ♛
  '1481792319328878713', // 🜲 Thᥱ G᥆ᥲt᥉  🜲
  '1502148024325898463', // .𖹭.ᐟ 𝑬𝒒𝒖𝒊𝒑𝒆 𝒅𝒆 𝒔𝒖𝒑𝒐𝒓𝒕𝒆 .ᐟ𖹭
  '1520888304835493888', // ⋆ 𝑪𝒐𝒐𝒓𝒅. 𝒅𝒆 𝑺𝒖𝒑𝒐𝒓𝒕𝒆 ⋆
];

// Cores temáticas Overwatch
const OW_ORANGE = 0xF99E1A; // dourado/laranja do logo
const OW_BLUE   = 0x00B4F0; // azul claro Overwatch

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasAllowedRole(member: GuildMember): boolean {
  return ALLOWED_ROLE_IDS.some((id) => member.roles.cache.has(id));
}

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
      content: `❌ Este comando só pode ser usado em <#${SORTEIO_CHANNEL_ID}>.`,
      ephemeral: true,
    });
    return false;
  }

  // Discord.js v14: interaction.member pode ser GuildMember (roles.cache) ou
  // APIInteractionGuildMember (roles como string[] de IDs). O payload da interação
  // SEMPRE inclui os IDs dos cargos — só o formato muda conforme o cache.
  const rawRoles = interaction.member?.roles;
  let memberHasRole: boolean;

  if (Array.isArray(rawRoles)) {
    // APIInteractionGuildMember: roles já é string[] de IDs — sem necessidade de fetch
    memberHasRole = ALLOWED_ROLE_IDS.some((id) => rawRoles.includes(id));
  } else {
    // GuildMember: roles é GuildMemberRoleManager com .cache
    memberHasRole = rawRoles
      ? ALLOWED_ROLE_IDS.some((id) => rawRoles.cache.has(id))
      : false;
  }

  if (!memberHasRole) {
    await interaction.reply({
      content: '❌ Você não tem permissão para usar este comando.',
      ephemeral: true,
    });
    return false;
  }
  return true;
}

// ─── Embed de resultado: Por Função ──────────────────────────────────────────

function buildFuncoesEmbed(
  tank: string[],
  dano: string[],
  suporte: string[]
): EmbedBuilder {
  const sep = '\u200B'; // zero-width space para espaçamento visual

  return new EmbedBuilder()
    .setColor(OW_ORANGE)
    .setTitle('⚡ SORTEIO OVERWATCH ⚡')
    .setDescription(
      '> Os heróis foram escolhidos. Boa sorte no campo de batalha!\n' + sep
    )
    .addFields(
      {
        name: '🛡️  __Tanque__',
        value: tank.map((n) => `╠ **${n}**`).join('\n') + '\n' + sep,
        inline: false,
      },
      {
        name: '⚔️  __Dano__',
        value: dano.map((n) => `╠ **${n}**`).join('\n') + '\n' + sep,
        inline: false,
      },
      {
        name: '❤️  __Suporte__',
        value: suporte.map((n) => `╠ **${n}**`).join('\n') + '\n' + sep,
        inline: false,
      },
    )
    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Overwatch_circle_logo.svg/240px-Overwatch_circle_logo.svg.png')
    .setFooter({ text: '🐾 Pet do GG  •  Sorteio Overwatch' })
    .setTimestamp();
}

// ─── Embed de resultado: Simples ──────────────────────────────────────────────

function buildSimplesEmbed(sorteados: string[], quantidade: number): EmbedBuilder {
  const sep = '\u200B';
  const numbered = sorteados.map((n, i) => `\`${i + 1}.\` **${n}**`).join('\n');

  return new EmbedBuilder()
    .setColor(OW_BLUE)
    .setTitle(`⚡ SORTEIO ${quantidade}v${quantidade} ⚡`)
    .setDescription(
      `> O destino escolheu os ${quantidade} heróis desta partida!\n${sep}`
    )
    .addFields({
      name: '🎮  __Jogadores sorteados__',
      value: numbered + '\n' + sep,
      inline: false,
    })
    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Overwatch_circle_logo.svg/240px-Overwatch_circle_logo.svg.png')
    .setFooter({ text: '🐾 Pet do GG  •  Sorteio Overwatch' })
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
      .setTitle('⚡ Sorteio Overwatch — Por Função');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('tanque')
          .setLabel('🛡️ Tanques (um por linha ou vírgula)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Nome1\nNome2\nNome3')
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('dano')
          .setLabel('⚔️ Dano (um por linha ou vírgula)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Nome1\nNome2\nNome3')
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('suporte')
          .setLabel('❤️ Suporte (um por linha ou vírgula)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Nome1\nNome2')
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
    return;
  }

  if (modo === 'simples') {
    // Quantidade vem da opção do comando (5 ou 6); default = 5
    const quantidade = interaction.options.getInteger('quantidade') ?? 5;

    const modal = new ModalBuilder()
      // Codifica a quantidade no customId para recuperar no submit
      .setCustomId(`sorteio_simples_${quantidade}`)
      .setTitle(`⚡ Sorteio ${quantidade}v${quantidade} — Lista de Jogadores`);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('lista')
          .setLabel(`📋 Jogadores (sorteia ${quantidade} — um por linha/vírgula)`)
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
    if (tanques.length  < 1) erros.push('**Tanque** precisa de ao menos **1** jogador.');
    if (danos.length    < 2) erros.push('**Dano** precisa de ao menos **2** jogadores.');
    if (suportes.length < 2) erros.push('**Suporte** precisa de ao menos **2** jogadores.');

    if (erros.length > 0) {
      await interaction.editReply({
        content: `❌ Não foi possível sortear:\n${erros.map((e) => `• ${e}`).join('\n')}`,
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
    // Recupera a quantidade do customId (ex: "sorteio_simples_6" → 6)
    const quantidade = parseInt(interaction.customId.split('_')[2] ?? '5', 10);
    const lista = parseList(interaction.fields.getTextInputValue('lista'));

    if (lista.length < quantidade) {
      await interaction.editReply({
        content:
          `❌ A lista precisa ter ao menos **${quantidade} jogadores** para este sorteio. ` +
          `Você enviou ${lista.length}.`,
      });
      return;
    }

    const embed = buildSimplesEmbed(pick(lista, quantidade), quantidade);
    await interaction.editReply({ embeds: [embed] });
    return;
  }
}
