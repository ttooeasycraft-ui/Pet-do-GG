import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';

import {
  CARD_POOL,
  RARITY_EMOJI,
  RARITY_LABELS,
  ROLE_LABELS,
  findCard,
} from '../game/cards.js';
import {
  acceptDuel,
  addCardToDeck,
  calculateCardStats,
  claimDailyCoins,
  createDuelChallenge,
  declineDuel,
  GameDatabaseUnavailableError,
  getGamePlayer,
  getWinRanking,
  rarityName,
  removeCardFromDeck,
  saveDuelMessage,
  summonCard,
  updateTopDuelRole,
  upgradeCard,
} from '../game/engine.js';

function formatCard(cardId: string, player: Awaited<ReturnType<typeof getGamePlayer>>): string {
  const card = findCard(cardId);
  const stats = calculateCardStats(player, cardId);
  if (!card || !stats) return `• Carta desconhecida (${cardId})`;
  return `${RARITY_EMOJI[card.rarity]} **${card.name}** · ${ROLE_LABELS[card.role]} · ${rarityName(card)} · ⚔️ ${stats.damage} · ❤️ ${stats.hp}`;
}

async function respondDatabaseError(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  error: unknown,
): Promise<boolean> {
  if (!(error instanceof GameDatabaseUnavailableError)) return false;
  const content = 'O banco do jogo ainda não está conectado. Tente novamente em alguns instantes.';
  if (interaction.isButton()) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content, embeds: [], components: [] });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } else if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content, embeds: [] });
  } else {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
  return true;
}

async function handleDraw(interaction: ChatInputCommandInteraction): Promise<void> {
  const result = await summonCard(interaction.user.id);
  if (result.retryAt) {
    await interaction.reply({
      content: `Sua próxima puxada fica disponível <t:${Math.floor(result.retryAt / 1_000)}:R>.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x8e44ad)
    .setTitle(`${RARITY_EMOJI[result.card.rarity]} Carta ${result.duplicate ? 'repetida' : 'nova'}!`)
    .setDescription(
      `**${result.card.name}**\n${ROLE_LABELS[result.card.role]} · ${rarityName(result.card)}\n` +
      `⚔️ ${result.card.damage} de dano base · ❤️ ${result.card.hp} HP base\n` +
      result.card.description +
      (result.duplicate ? `\n\nVocê recebeu **${result.coins} moedas** pela repetida.` : ''),
    );
  await interaction.reply({ embeds: [embed] });
}

async function handleDaily(interaction: ChatInputCommandInteraction): Promise<void> {
  const result = await claimDailyCoins(interaction.user.id);
  if (!result.cardCount) {
    await interaction.reply({
      content: 'Você ainda não tem cartas. Use `/cartas puxar` para começar sua coleção.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (result.nextAt) {
    await interaction.reply({
      content: `Você já recebeu as moedas de hoje. Pode coletar novamente <t:${Math.floor(result.nextAt / 1_000)}:R>.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    content: `Você recebeu **${result.coins} moedas** pelas suas ${result.cardCount} cartas. Colete novamente em 24 horas.`,
  });
}

async function handleCollection(interaction: ChatInputCommandInteraction): Promise<void> {
  const target = interaction.options.getUser('jogador') ?? interaction.user;
  const player = await getGamePlayer(target.id);
  const lines = player.cards.map((cardId) => formatCard(cardId, player));
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🃏 Coleção de ${target.username}`)
    .setDescription(lines.length ? lines.join('\n') : 'Ainda sem cartas. Use `/cartas puxar` para conseguir a primeira.')
    .addFields(
      { name: 'Moedas', value: `${player.coins}`, inline: true },
      { name: 'Cartas', value: `${player.cards.length}/${CARD_POOL.length}`, inline: true },
      { name: 'Vitórias X1', value: `${player.wins}`, inline: true },
    );
  await interaction.reply({ embeds: [embed] });
}

async function handleDeck(interaction: ChatInputCommandInteraction): Promise<void> {
  const player = await getGamePlayer(interaction.user.id);
  const lines = player.deck.map((cardId) => formatCard(cardId, player));
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🛡️ Deck de ${interaction.user.username}`)
    .setDescription(lines.length ? lines.join('\n') : 'Seu deck está vazio.')
    .setFooter({ text: `Máximo de 4 cartas; um X1 exige 4 cartas e pelo menos 2 papéis diferentes.` });
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleAddCard(interaction: ChatInputCommandInteraction): Promise<void> {
  const cardId = interaction.options.getString('carta', true);
  const result = await addCardToDeck(interaction.user.id, cardId);
  if (!result.ok) {
    const messages: Record<string, string> = {
      card_not_owned: 'Essa carta não está na sua coleção.',
      already_in_deck: 'Essa carta já está no deck.',
      deck_full: 'Seu deck já tem 4 cartas. Remova uma antes de adicionar outra.',
      needs_variety: 'Para fechar o deck, escolha pelo menos 2 papéis diferentes.',
    };
    await interaction.reply({
      content: messages[result.reason ?? ''] ?? 'Não foi possível adicionar essa carta.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const player = await getGamePlayer(interaction.user.id);
  await interaction.reply({
    content: `**${findCard(cardId)?.name}** entrou no deck (${result.deck?.length}/4).\n${result.deck?.map((id) => formatCard(id, player)).join('\n')}`,
  });
}

async function handleRemoveCard(interaction: ChatInputCommandInteraction): Promise<void> {
  const cardId = interaction.options.getString('carta', true);
  const result = await removeCardFromDeck(interaction.user.id, cardId);
  if (!result.ok) {
    await interaction.reply({ content: 'Essa carta não está no seu deck.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({
    content: `Carta removida. Seu deck agora tem ${result.deck.length}/4 cartas.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleUpgrade(interaction: ChatInputCommandInteraction): Promise<void> {
  const cardId = interaction.options.getString('carta', true);
  const stat = interaction.options.getString('atributo', true) as 'damage' | 'hp';
  const result = await upgradeCard(interaction.user.id, cardId, stat);
  if (!result) {
    const player = await getGamePlayer(interaction.user.id);
    const message = !player.cards.includes(cardId)
      ? 'Essa carta não está na sua coleção.'
      : 'Você não tem moedas suficientes para esse upgrade.';
    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    return;
  }

  const player = await getGamePlayer(interaction.user.id);
  await interaction.reply({
    content: `Upgrade de **${stat === 'damage' ? 'dano' : 'HP'}** concluído! Nível ${result.newLevel}; custo ${result.cost} moedas. Saldo: ${player.coins}.`,
  });
}

async function handleDuel(interaction: ChatInputCommandInteraction): Promise<void> {
  const opponent = interaction.options.getUser('jogador', true);
  if (opponent.bot) {
    await interaction.reply({ content: 'O desafio X1 só pode ser feito contra outro jogador.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.guildId) {
    await interaction.reply({ content: 'O X1 só pode ser iniciado dentro de um servidor.', flags: MessageFlags.Ephemeral });
    return;
  }

  const challenge = await createDuelChallenge(
    interaction.guildId,
    interaction.channelId,
    interaction.user.id,
    opponent.id,
  );
  if ('error' in challenge) {
    const messages: Record<string, string> = {
      self: 'Você não pode desafiar a si mesmo.',
      your_deck: 'Monte um deck com 4 cartas e pelo menos 2 papéis diferentes antes do X1.',
      opponent_deck: `**${opponent.username}** precisa preparar um deck válido antes do X1.`,
    };
    await interaction.reply({ content: messages[challenge.error] ?? 'Não foi possível iniciar o desafio.', flags: MessageFlags.Ephemeral });
    return;
  }

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`cardduel_accept:${challenge.duel._id}`)
      .setLabel('Aceitar X1')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`cardduel_decline:${challenge.duel._id}`)
      .setLabel('Recusar')
      .setStyle(ButtonStyle.Secondary),
  );
  await interaction.reply({
    content: `<@${opponent.id}>, <@${interaction.user.id}> desafiou você para um X1 de cartas. O desafio expira em 10 minutos.`,
    components: [buttons],
    allowedMentions: { users: [opponent.id, interaction.user.id], parse: [] },
  });

  const response = await interaction.fetchReply();
  await saveDuelMessage(challenge.duel._id, response.id);
}

async function handleRanking(interaction: ChatInputCommandInteraction): Promise<void> {
  const ranking = await getWinRanking(10);
  if (!ranking.length) {
    await interaction.reply({ content: 'Ainda não há vitórias em X1. O ranking conta apenas vitórias, não moedas.', flags: MessageFlags.Ephemeral });
    return;
  }

  const lines = ranking.map((player, index) =>
    `**${index + 1}.** <@${player._id}> — **${player.wins} vitórias** · ${player.losses} derrotas`,
  );
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('🏆 Ranking X1 — vitórias')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Moedas e upgrades não contam no ranking. Top 3 recebe o cargo Destaque X1.' });
  await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}

export async function handleCardGameCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  try {
    switch (interaction.options.getSubcommand()) {
      case 'puxar': await handleDraw(interaction); break;
      case 'diaria': await handleDaily(interaction); break;
      case 'colecao': await handleCollection(interaction); break;
      case 'deck': await handleDeck(interaction); break;
      case 'adicionar': await handleAddCard(interaction); break;
      case 'remover': await handleRemoveCard(interaction); break;
      case 'upar': await handleUpgrade(interaction); break;
      case 'duelo': await handleDuel(interaction); break;
      case 'ranking': await handleRanking(interaction); break;
    }
  } catch (error) {
    if (await respondDatabaseError(interaction, error)) return;
    throw error;
  }
}

export async function handleCardGameButton(
  interaction: ButtonInteraction,
): Promise<boolean> {
  const [action, duelId] = interaction.customId.split(':', 2);
  if (!duelId || !['cardduel_accept', 'cardduel_decline'].includes(action)) return false;

  await interaction.deferUpdate();
  try {
    if (action === 'cardduel_decline') {
      const result = await declineDuel(duelId, interaction.user.id);
      const messages = {
        ok: 'Desafio recusado.',
        not_found: 'Esse desafio não existe mais.',
        not_yours: 'Só a pessoa desafiada pode recusar.',
        not_pending: 'Esse desafio já foi respondido ou expirou.',
      };
      await interaction.editReply({ content: messages[result], components: [] });
      return true;
    }

    const accepted = await acceptDuel(duelId, interaction.user.id);
    if (accepted.error || !accepted.result) {
      const messages: Record<string, string> = {
        not_found: 'Esse desafio não existe mais.',
        not_yours: 'Só a pessoa desafiada pode aceitar.',
        not_pending: 'Esse desafio já foi respondido.',
        expired: 'O desafio expirou; crie outro para jogar.',
        deck_changed: 'Um dos decks deixou de ser válido. Prepare os dois decks e desafie novamente.',
      };
      await interaction.editReply({
        content: messages[accepted.error ?? ''] ?? 'Não foi possível concluir o X1.',
        components: [],
      });
      return true;
    }

    if (interaction.guild) {
      await updateTopDuelRole(interaction.guild).catch((error) => {
        console.error('[CardGame] Não foi possível atualizar o cargo do ranking:', error?.name ?? 'erro');
      });
    }

    const { result, duel } = accepted;
    const outcome = result.winnerId
      ? `🏆 Vencedor: <@${result.winnerId}> · <@${result.loserId}> perdeu.`
      : '🤝 O X1 terminou empatado.';
    const content = `${outcome}\nBatalha encerrada em **${result.rounds} rodadas**.\n\n${result.summary || 'As duas equipes terminaram com a mesma vida.'}`;
    await interaction.editReply({
      content,
      components: [],
      allowedMentions: {
        users: [duel?.challengerId ?? '', duel?.challengedId ?? ''].filter(Boolean),
        parse: [],
      },
    });
    return true;
  } catch (error) {
    if (await respondDatabaseError(interaction, error)) return true;
    throw error;
  }
}
