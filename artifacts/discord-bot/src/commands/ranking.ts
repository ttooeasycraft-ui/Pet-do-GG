import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';

import { getChatXpRanking } from '../config.js';
import { getChatXpLevel } from '../events/chat-xp.js';

export async function handleRanking(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const ranking = getChatXpRanking(10);

  if (!ranking.length) {
    await interaction.reply({
      content: 'Ainda não há XP de chat registrado. Converse no servidor para aparecer no ranking!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const lines = ranking.map(({ userId, xp }, index) => {
    const level = getChatXpLevel(xp);
    return `**${index + 1}.** <@${userId}> — **${xp} XP** · ${level.name}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xe84393)
    .setTitle('💬 Ranking de XP do chat')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Cada membro tem seu próprio XP. Mensagens repetidas e spam não dão XP.' });

  await interaction.reply({ embeds: [embed] });
}