import {
  GuildMember,
  EmbedBuilder,
  TextChannel,
  AttachmentBuilder,
} from 'discord.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getConfig } from '../config.js';
import { connectGameDatabase } from '../game/database.js';

const LOCAL_BANNER = join(process.cwd(), 'assets', 'banner-boas-vindas.png');
const WELCOME_DEDUPE_WINDOW_MS = 30_000;

interface WelcomeDeliveryLock {
  _id: string;
  guildId: string;
  memberId: string;
  expiresAt?: Date;
  updatedAt: Date;
}

function isDuplicateMongoKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

async function reserveWelcomeMessage(member: GuildMember): Promise<boolean> {
  const database = await connectGameDatabase();
  const collection = database.collection<WelcomeDeliveryLock>('welcome_delivery_locks');
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  const now = Date.now();
  const lockId = `${member.guild.id}:${member.id}`;
  try {
    const result = await collection.updateOne(
      {
        _id: lockId,
        $or: [
          { expiresAt: { $lte: new Date(now) } },
          { expiresAt: { $exists: false } },
        ],
      },
      {
        $set: {
          guildId: member.guild.id,
          memberId: member.id,
          expiresAt: new Date(now + WELCOME_DEDUPE_WINDOW_MS),
          updatedAt: new Date(now),
        },
      },
      { upsert: true },
    );
    return result.matchedCount === 1 || result.upsertedCount === 1;
  } catch (error) {
    if (isDuplicateMongoKeyError(error)) return false;
    throw error;
  }
}

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

  if (!(await reserveWelcomeMessage(member))) {
    console.log(`[Welcome] Boas-vindas duplicada suprimida para ${member.id}.`);
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
