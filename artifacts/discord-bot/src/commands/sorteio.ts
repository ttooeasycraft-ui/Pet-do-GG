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

/** Canal exclusivo onde o /sorteio pode ser usado */
const SORTEIO_CHANNEL_ID = '1524833320658141394';

/** Cargos autorizados a usar o /sorteio */
const ALLOWED_ROLE_IDS = [
  '1503440562211127316', // ♛ 𝑺𝒖𝒑𝒓𝒆𝒎𝒂 ♛
  '1481792319328878713', // 🜲 Thᥱ G᥆ᥲt᥉  🜲
  '1502148024325898463', // .𖹭.ᐟ 𝑬𝒒𝒖𝒊𝒑𝒆 𝒅𝒆 𝒔𝒖𝒑𝒐𝒓𝒕𝒆 .ᐟ𖹭
  '1520888304835493888', // ⋆ 𝑪𝒐𝒐𝒓𝒅. 𝒅𝒆 𝑺𝒖𝒑𝒐𝒓𝒕𝒆 ⋆
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Verifica se o membro tem ao menos um dos cargos autorizados */
function hasAllowedRole(member: GuildMember): boolean {
  return ALLOWED_ROLE_IDS.some((id) => member.roles.cache.has(id));
}

/** Separa uma lista de nomes/menções por linha ou vírgula e remove vazios */
function parseList(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Embaralha um array (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Sorteia `n` itens de uma lista embaralhada */
function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

// ─── Validação de acesso ─────────────────────────────────────────────────────

async function checkAccess(
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  // Verifica canal
  if (interaction.channelId !== SORTEIO_CHANNEL_ID) {
    await interaction.reply({
      content: `❌ Este comando só pode ser usado no canal <#${SORTEIO_CHANNEL_ID}>.`,
      ephemeral: true,
    });
    return false;
  }

  // Verifica cargo
  const member = interaction.member as GuildMember | null;
  if (!member || !hasAllowedRole(member)) {
    await interaction.reply({
      content: '❌ Você não tem permissão para usar este comando.',
      ephemeral: true,
    });
    return false;
  }

  return true;
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
      .setTitle('Sorteio por Função');

    const tanqueInput = new TextInputBuilder()
      .setCustomId('tanque')
      .setLabel('🛡️ Tanques (um por linha ou vírgula)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('João\nMaria\nPedro')
      .setRequired(true);

    const danoInput = new TextInputBuilder()
      .setCustomId('dano')
      .setLabel('⚔️ Dano (um por linha ou vírgula)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ana\nCarlos\nLuiz\nBia')
      .setRequired(true);

    const suporteInput = new TextInputBuilder()
      .setCustomId('suporte')
      .setLabel('💊 Suporte (um por linha ou vírgula)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Fernanda\nRafael')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(tanqueInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(danoInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(suporteInput)
    );

    await interaction.showModal(modal);
    return;
  }

  if (modo === 'simples') {
    const modal = new ModalBuilder()
      .setCustomId('sorteio_simples')
      .setTitle('Sorteio Simples (5v5 / 6v6)');

    const listaInput = new TextInputBuilder()
      .setCustomId('lista')
      .setLabel('📋 Lista de jogadores (um por linha ou vírgula)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('João\nMaria\nPedro\nAna\nCarlos\n...')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(listaInput)
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

  // ── Modo: por função ──────────────────────────────────────────────────────
  if (interaction.customId === 'sorteio_funcoes') {
    const tanques = parseList(interaction.fields.getTextInputValue('tanque'));
    const danos = parseList(interaction.fields.getTextInputValue('dano'));
    const suportes = parseList(interaction.fields.getTextInputValue('suporte'));

    const erros: string[] = [];
    if (tanques.length < 1) erros.push('Tanque precisa de ao menos **1** jogador.');
    if (danos.length < 2) erros.push('Dano precisa de ao menos **2** jogadores.');
    if (suportes.length < 2) erros.push('Suporte precisa de ao menos **2** jogadores.');

    if (erros.length > 0) {
      await interaction.editReply({
        content: `❌ Não foi possível sortear:\n${erros.map((e) => `• ${e}`).join('\n')}`,
      });
      return;
    }

    const sorteadosTanque = pick(tanques, 1);
    const sorteadosDano = pick(danos, 2);
    const sorteadosSuporte = pick(suportes, 2);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🎲 Resultado do Sorteio — Por Função')
      .addFields(
        {
          name: '🛡️ Tanque (1)',
          value: sorteadosTanque.map((n) => `• ${n}`).join('\n'),
          inline: false,
        },
        {
          name: '⚔️ Dano (2)',
          value: sorteadosDano.map((n) => `• ${n}`).join('\n'),
          inline: false,
        },
        {
          name: '💊 Suporte (2)',
          value: sorteadosSuporte.map((n) => `• ${n}`).join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: 'Pet do GG • Sorteio' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── Modo: simples ─────────────────────────────────────────────────────────
  if (interaction.customId === 'sorteio_simples') {
    const lista = parseList(interaction.fields.getTextInputValue('lista'));

    if (lista.length < 5) {
      await interaction.editReply({
        content: `❌ A lista precisa ter ao menos **5 jogadores** para sortear um time de 5. Você enviou ${lista.length}.`,
      });
      return;
    }

    const sorteados = pick(lista, 5);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🎲 Resultado do Sorteio — Time de 5')
      .setDescription(
        sorteados.map((n, i) => `**${i + 1}.** ${n}`).join('\n')
      )
      .setFooter({ text: 'Pet do GG • Sorteio' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }
}
