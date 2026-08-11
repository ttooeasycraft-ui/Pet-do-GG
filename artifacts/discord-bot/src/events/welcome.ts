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

// ─── Trava anti-duplicação ────────────────────────────────────────────────
// Garante que, mesmo se o evento "membro entrou" disparar mais de uma vez
// para a mesma pessoa (bug comum quando o listener é registrado em
// duplicidade, ou o bot reconecta/reprocessa o evento), a mensagem de
// boas-vindas só é enviada UMA VEZ por pessoa a cada entrada no servidor.
const recentlyWelcomed = new Map<string, number>();
const DEDUPE_WINDOW_MS = 60_000; // 1 minuto de "proteção" após cada boas-vindas

function alreadyWelcomedRecently(key: string): boolean {
  const last = recentlyWelcomed.get(key);
  const now = Date.now();

  // Limpa entradas antigas de vez em quando pra não crescer pra sempre
  if (recentlyWelcomed.size > 500) {
    for (const [id, timestamp] of recentlyWelcomed) {
      if (now - timestamp > DEDUPE_WINDOW_MS) recentlyWelcomed.delete(id);
    }
  }

  if (last && now - last < DEDUPE_WINDOW_MS) {
    return true;
  }

  recentlyWelcomed.set(key, now);
  return false;
}

export async function handleWelcome(member: GuildMember): Promise<void> {
  const dedupeKey = `${member.guild.id}:${member.id}`;
  if (alreadyWelcomedRecently(dedupeKey)) {
    console.warn(
      `[Welcome] Ignorando chamada duplicada (memória) de boas-vindas para ${member.user.username} (${member.id}).`
    );
    return;
  }

  // Pequeno atraso (debounce) antes de processar de verdade: se o evento
  // disparar de novo pra mesma pessoa quase ao mesmo tempo, a trava acima já
  // vai bloquear a segunda chamada antes dela sequer chegar aqui.
  await new Promise((resolve) => setTimeout(resolve, 6_000));

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

  // ─── Segunda camada de proteção ──────────────────────────────────────────
  // Além da trava em memória (que se perde se o bot reiniciar), checa
  // diretamente no histórico do canal se já existe uma mensagem de
  // boas-vindas recente mencionando esse membro. Isso protege até contra o
  // caso raro do bot cair/reiniciar bem no meio do processamento do evento.
  try {
    const recentMessages = await channel.messages.fetch({ limit: 10 });
    const alreadyPostedInChannel = recentMessages.some((msg) => {
      const isRecent = Date.now() - msg.createdTimestamp < DEDUPE_WINDOW_MS;
      const mentionsMember = msg.mentions.users.has(member.id) || msg.content.includes(member.id);
      const isFromThisBot = msg.author.id === member.client.user?.id;
      return isRecent && mentionsMember && isFromThisBot;
    });

    if (alreadyPostedInChannel) {
      console.warn(
        `[Welcome] Ignorando duplicata (histórico do canal) para ${member.user.username} (${member.id}).`
      );
      return;
    }
  } catch (error) {
    // Se a checagem do histórico falhar por algum motivo, não bloqueia o
    // fluxo normal — só segue com a trava em memória mesmo.
    console.warn('[Welcome] Não foi possível checar histórico do canal:', error);
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

  try {
    await channel.send({
      content: `Bem-vindo(a) ao **${guildName}**, ${member}!`,
      embeds:  [embed],
      files,
    });
  } catch (error) {
    // Se der erro no envio, libera a trava pra permitir tentar de novo depois
    recentlyWelcomed.delete(dedupeKey);
    console.error(`[Welcome] Erro ao enviar boas-vindas para ${member.user.username}:`, error);
  }
}
