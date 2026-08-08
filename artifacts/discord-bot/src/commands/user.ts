import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  TextChannel,
  User,
} from 'discord.js';

function resolveUser(
  interaction: ChatInputCommandInteraction,
  optionName: string
): User {
  return interaction.options.getUser(optionName) ?? interaction.user;
}

export async function handleUserAvatar(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const user = resolveUser(interaction, 'usuario');
  const avatarUrl = user.displayAvatarURL({ size: 1024, extension: 'png' });

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`Avatar de ${user.globalName ?? user.username}`)
        .setImage(avatarUrl)
        .setColor(0x0099ff)
        .setFooter({ text: 'Pet do GG' }),
    ],
  });
}

export async function handleUserInfo(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const user = resolveUser(interaction, 'usuario');
  const member = interaction.guild
    ? await interaction.guild.members.fetch(user.id).catch(() => null)
    : null;
  const roles = member
    ? member.roles.cache
        .filter((role) => role.id !== interaction.guild!.id)
        .sort((a, b) => b.position - a.position)
        .map((role) => `<@&${role.id}>`)
        .slice(0, 20)
        .join(', ') || 'Nenhum cargo'
    : 'Usuário não está neste servidor';

  const createdAt = Math.floor(user.createdTimestamp / 1000);
  const joinedAt = member?.joinedTimestamp
    ? Math.floor(member.joinedTimestamp / 1000)
    : null;

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(`Informações de ${user.globalName ?? user.username}`)
        .setThumbnail(user.displayAvatarURL({ size: 512 }))
        .addFields(
          { name: 'Usuário', value: `<@${user.id}>`, inline: true },
          { name: 'ID', value: user.id, inline: true },
          { name: 'Conta criada', value: `<t:${createdAt}:F>`, inline: false },
          {
            name: 'Entrada no servidor',
            value: joinedAt ? `<t:${joinedAt}:F>` : 'Não disponível',
            inline: false,
          },
          { name: 'Cargos', value: roles, inline: false },
        )
        .setColor(0x0099ff)
        .setFooter({ text: 'Pet do GG · informações públicas' }),
    ],
  });
}

export async function handleSuggestion(
  interaction: ChatInputCommandInteraction,
  suggestionsChannelId: string
): Promise<void> {
  const text = interaction.options.getString('ideia', true).trim();
  const channel = await interaction.client.channels
    .fetch(suggestionsChannelId)
    .catch(() => null);

  if (!channel?.isTextBased()) {
    await interaction.reply({
      content: 'O canal de sugestões ainda não está configurado.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const message = await (channel as TextChannel).send({
    embeds: [
      new EmbedBuilder()
        .setTitle('Nova sugestão')
        .setDescription(text)
        .setColor(0x0099ff)
        .setAuthor({
          name: interaction.user.globalName ?? interaction.user.username,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setFooter({ text: `Pet do GG · autor: ${interaction.user.username}` })
        .setTimestamp(),
    ],
  });

  await message.react('👍');
  await message.react('👎');
  await interaction.reply({
    content: `Sua sugestão foi enviada em <#${suggestionsChannelId}>.`,
    flags: MessageFlags.Ephemeral,
  });
}