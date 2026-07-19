import {
  GuildMember,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { getConfig } from '../config.js';

export async function handleWelcome(member: GuildMember): Promise<void> {
  const channelId = process.env.WELCOME_CHANNEL_ID;

  const isValidSnowflake = (v: string | undefined) => /^\d{17,20}$/.test(v ?? '');
  if (!isValidSnowflake(channelId)) {
    console.warn(
      `[Welcome] WELCOME_CHANNEL_ID inválido ou não configurado: "${channelId}". ` +
      'Configure com o ID numérico do canal e reinicie o bot.'
    );
    return;
  }

  const channel = member.guild.channels.cache.get(channelId!);
  if (!channel || !(channel instanceof TextChannel)) {
    console.warn(
      `[Welcome] Canal ${channelId} não encontrado ou não é de texto. ` +
      'Verifique se o bot tem permissão de visualizar e enviar mensagens nesse canal.'
    );
    return;
  }

  const config      = getConfig();
  const guildName   = member.guild.name;
  const memberCount = member.guild.memberCount;
  const avatarUrl   = member.user.displayAvatarURL({ size: 512, extension: 'png' });

  // Substitui os placeholders no texto configurável
  const description = config.welcome.text
    .replace(/\{membro\}/g,    `${member}`)
    .replace(/\{servidor\}/g,  guildName)
    .replace(/\{contagem\}/g,  String(memberCount));

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({
      name:    `${member.user.username} acabou de chegar!`,
      iconURL: avatarUrl,
    })
    .setTitle('🎉 Você spawnou no lugar certo!')
    .setDescription(description)
    .setThumbnail(avatarUrl)
    .setFooter({ text: `${guildName} • Pet do GG` })
    .setTimestamp();

  // Imagem/banner configurável — exibida abaixo do texto do embed
  if (config.welcome.imageUrl) {
    embed.setImage(config.welcome.imageUrl);
  }

  await channel.send({
    content: `Boas-vindas à **${guildName}**, ${member}!`,
    embeds:  [embed],
  });
}
