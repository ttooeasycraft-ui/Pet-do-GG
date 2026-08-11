import {
  GuildMember,
  EmbedBuilder,
  TextChannel,
  AttachmentBuilder,
} from 'discord.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const LOCAL_BANNER = join(process.cwd(), 'assets', 'banner-boas-vindas.png');

export async function handleWelcome(member: GuildMember): Promise<void> {
  // ID do canal de testes do seu servidor
  const channelId = '1481456467759468556';

  const channel = member.guild.channels.cache.get(channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    console.warn(
      `[Welcome] Canal ${channelId} não encontrado ou não é de texto.`
    );
    return;
  }

  const guildName   = member.guild.name;
  const memberCount = member.guild.memberCount;
  const avatarUrl   = member.user.displayAvatarURL({ size: 512, extension: 'png' });

  // Texto idêntico ao da primeira mensagem do print (da Perséfone)
  const description = 
    `Olá player novo!! Muito bom ter mais um Noob- ops, jogador conosco ✨❤️\n\n` +
    `${member} acabou de entrar!\n` +
    `Você é o nosso **${memberCount}º** membro! 🐾`;

  const useLocalBanner = existsSync(LOCAL_BANNER);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name:    `${member.user.username} acabou de chegar!`,
      iconURL: avatarUrl,
    })
    .setDescription(description)
    .setThumbnail(avatarUrl)
    .setFooter({ text: `❗ ${guildName} ❗ · Pet do GG` })
    .setTimestamp();

  if (useLocalBanner) {
    embed.setImage('attachment://banner-boas-vindas.png');
  }

  const files: AttachmentBuilder[] = useLocalBanner
    ? [new AttachmentBuilder(LOCAL_BANNER, { name: 'banner-boas-vindas.png' })]
    : [];

  await channel.send({
    content: `Bem-vindo(a) ao ❗ **${guildName}** ❗ , ${member}!`,
    embeds:  [embed],
    files,
  });
}
