import {
  GuildMember,
  EmbedBuilder,
  TextChannel,
  AttachmentBuilder,
} from 'discord.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getConfig } from '../config.js';

const LOCAL_BANNER = join(process.cwd(), 'assets', 'banner-boas-vindas.png');

// ─── Trava anti-duplicação / clonagem ─────────────────────────────────────────
// Evita que eventos disparados em sequência enviem a mesma mensagem de boas-vindas.
const welcomeLocks = new Set<string>();

export async function handleWelcome(member: GuildMember): Promise<void> {
  // Se o membro já está sendo processado ou recebeu boas-vindas nos últimos segundos, cancela.
  if (welcomeLocks.has(member.id)) {
    console.warn(`[Welcome] Evento duplicado ignorado para o membro: ${member.user.tag} (${member.id})`);
    return;
  }

  // Trava o ID do membro por 10 segundos
  welcomeLocks.add(member.id);
  setTimeout(() => welcomeLocks.delete(member.id), 10_000);

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
    .replace(/\{membro\}/g,   `${member}`)
    .replace(/\{servidor\}/g, guildName)
    .replace(/\{contagem\}/g, String(memberCount));

  // Decide a imagem: URL externa configurada > banner local > nenhuma
  const externalUrl = config.welcome.imageUrl.trim();
  const useLocalBanner = !externalUrl && existsSync(LOCAL_BANNER);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name:    `${member.user.username} acabou de chegar!`,
      iconURL: avatarUrl,
    })
    .setDescription(description)
    .setThumbnail(avatarUrl)
    .setFooter({ text: `${guildName} · Pet do GG` })
    .setTimestamp();

  if (externalUrl) {
    embed.setImage(externalUrl);
  } else if (useLocalBanner) {
    embed.setImage('attachment://banner-boas-vindas.png');
  }

  const files: AttachmentBuilder[] = useLocalBanner
    ? [new AttachmentBuilder(LOCAL_BANNER, { name: 'banner-boas-vindas.png' })]
    : [];

  await channel.send({
    content: `Bem-vindo(a) ao **${guildName}**, ${member}!`,
    embeds:  [embed],
    files,
  });
}
