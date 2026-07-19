import {
  GuildMember,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';

export async function handleWelcome(member: GuildMember): Promise<void> {
  const channelId = process.env.WELCOME_CHANNEL_ID;
  if (!channelId) {
    console.error('[Welcome] WELCOME_CHANNEL_ID não configurado.');
    return;
  }

  const channel = member.guild.channels.cache.get(channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    console.error(`[Welcome] Canal ${channelId} não encontrado ou não é de texto.`);
    return;
  }

  const memberCount = member.guild.memberCount;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🐾 Bem-vindo(a) ao Pet do GG!')
    .setDescription(
      `Olá, ${member}! 👋\n\n` +
      `Seja muito bem-vindo(a) ao servidor! Estamos felizes em ter você aqui.\n\n` +
      `Você é o nosso **${memberCount}º** membro! 🎉`
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: 'Pet do GG • Boas-vindas' })
    .setTimestamp();

  await channel.send({
    content: `${member} acabou de entrar no servidor!`,
    embeds: [embed],
  });
}
