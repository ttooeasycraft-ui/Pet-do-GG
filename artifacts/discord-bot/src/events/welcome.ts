import {
  GuildMember,
  EmbedBuilder,
  TextChannel,
  AttachmentBuilder,
} from 'discord.js';

export async function handleWelcome(member: GuildMember): Promise<void> {
  const channelId = process.env.WELCOME_CHANNEL_ID;

  // Valida se o WELCOME_CHANNEL_ID é um ID numérico real
  const isValidSnowflake = (v: string | undefined) => /^\d{17,20}$/.test(v ?? '');
  if (!isValidSnowflake(channelId)) {
    console.warn(
      `[Welcome] WELCOME_CHANNEL_ID inválido ou não configurado: "${channelId}". ` +
      'Configure com o ID numérico do canal e reinicie o bot.'
    );
    return; // Para aqui — o bot NÃO cria canal, apenas avisa e aguarda configuração
  }

  // Busca o canal existente no cache do servidor (nunca cria um novo)
  const channel = member.guild.channels.cache.get(channelId!);
  if (!channel || !(channel instanceof TextChannel)) {
    console.warn(
      `[Welcome] Canal ${channelId} não encontrado no servidor ou não é de texto. ` +
      'Verifique se o bot tem permissão de visualizar e enviar mensagens nesse canal.'
    );
    return; // Para aqui — o bot NÃO cria canal
  }

  const guildName  = member.guild.name;
  const memberCount = member.guild.memberCount;

  // Avatar do NOVO MEMBRO em alta resolução (512px), com fallback para o avatar padrão do Discord
  const avatarUrl = member.user.displayAvatarURL({ size: 512, extension: 'png' });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({
      name: `${member.user.username} acabou de chegar!`,
      iconURL: avatarUrl,
    })
    .setTitle('🎉 Você spawnou no lugar certo!')
    .setDescription(
      `Bem-vindo(a), ${member}!\n` +
      `Você acabou de chegar em **${guildName}**.\n\n` +
      `Você é o nosso **${memberCount}º** membro! 🐾`
    )
    // Avatar do membro em destaque no canto superior direito do embed
    .setThumbnail(avatarUrl)
    .setFooter({ text: `${guildName} • Pet do GG` })
    .setTimestamp();

  await channel.send({
    content: `Boas-vindas à **${guildName}**, ${member}!`,
    embeds: [embed],
  });
}
