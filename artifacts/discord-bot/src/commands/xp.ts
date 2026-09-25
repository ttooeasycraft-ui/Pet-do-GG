import {
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';

import {
  getChatXp,
  getVoiceXpSeconds,
} from '../config.js';
import { CHAT_XP_LEVELS, getChatXpLevel } from '../events/chat-xp.js';
import { VOICE_XP_LEVELS, getVoiceXpLevel } from '../events/voice-xp.js';

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return `${hours}h ${minutes}min ${remainder}s`;
}

export async function handleXp(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const userId = interaction.user.id;
  const chatXp = getChatXp(userId);
  const voiceSeconds = getVoiceXpSeconds(userId);
  const chatLevel = getChatXpLevel(chatXp);
  const voiceLevel = getVoiceXpLevel(voiceSeconds);
  const voiceHours = voiceSeconds / 3_600;
  const nextVoiceLevel = VOICE_XP_LEVELS.find(
    (level) => voiceHours < level.thresholdHours,
  );
  const nextChatLevel = CHAT_XP_LEVELS.find(
    (level) => chatXp < level.thresholdXp,
  );
  const displayName =
    interaction.guild?.members.cache.get(userId)?.displayName ??
    interaction.user.username;

  const embed = new EmbedBuilder()
    .setColor(0xe84393)
    .setTitle(`📊 XP de ${displayName}`)
    .addFields(
      {
        name: '💬 XP de chat',
        value: `${chatXp} XP\nCargo: **${chatLevel.name}**\n${
          nextChatLevel
            ? `Próximo: ${nextChatLevel.name} em ${nextChatLevel.thresholdXp} XP`
            : 'Nível máximo alcançado'
        }`,
        inline: true,
      },
      {
        name: '🎧 Tempo em call',
        value: `${formatDuration(voiceSeconds)}\nCargo: **${voiceLevel.name}**\n${
          nextVoiceLevel
            ? `Próximo: ${nextVoiceLevel.name} em ${nextVoiceLevel.thresholdHours}h`
            : 'Nível máximo alcançado'
        }`,
        inline: true,
      },
    )
    .setFooter({ text: 'O XP de chat e o tempo de call são individuais.' });

  await interaction.reply({ embeds: [embed] });
}