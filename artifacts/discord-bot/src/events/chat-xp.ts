import {
  Client,
  Guild,
  GuildMember,
  Message,
  PermissionFlagsBits,
  Role,
} from 'discord.js';

import {
  addChatXp,
  flushConfigPersistence,
  getChatXp,
  getChatXpLastAwardAt,
  getChatXpRoleId,
  getConfig,
  setChatXpLastAwardAt,
  setChatXpRoleId,
} from '../config.js';

const CHAT_XP_PER_MESSAGE = 1;
const CHAT_XP_COOLDOWN_MS = 8_000; // intervalo curto só pra evitar flood de teclado
const MIN_MESSAGE_LENGTH = 5; // mensagens minúsculas tipo "oi", "sim" não contam
const MIN_MESSAGE_WORDS = 2; // exige pelo menos 2 palavras
const MESSAGE_HISTORY_SIZE = 5; // quantas mensagens recentes guardamos pra detectar repetição
const MAX_AWARDS_PER_WINDOW = 8; // limite de segurança: no máx. 8 mensagens contam por minuto
const AWARDS_WINDOW_MS = 60_000;

export const CHAT_XP_LEVELS = [
  { key: 'leitor', name: 'Leitor', thresholdXp: 0, color: 0x95a5a6 },
  { key: 'tagarela', name: 'Tagarela', thresholdXp: 100, color: 0x3498db },
  { key: 'conversador', name: 'Conversador', thresholdXp: 300, color: 0x2ecc71 },
  { key: 'comunicador', name: 'Comunicador', thresholdXp: 700, color: 0x1abc9c },
  { key: 'orador', name: 'Orador', thresholdXp: 1_500, color: 0x9b59b6 },
  { key: 'influente', name: 'Influente', thresholdXp: 3_000, color: 0xe67e22 },
  { key: 'lenda_chat', name: 'Lenda do Chat', thresholdXp: 6_000, color: 0xe84393 },
  { key: 'voz_servidor', name: 'Voz do Servidor', thresholdXp: 10_000, color: 0xf1c40f },
] as const;

interface ChatRoleState {
  roles: Map<string, Role>;
}

const roleCache = new Map<string, ChatRoleState>();
const lastMessagesByUser = new Map<string, string[]>();
const awardTimestampsByUser = new Map<string, number[]>();

/** Normaliza a mensagem pra detectar repetição disfarçada (maiúsculas, espaços, "kkkkkk" etc.) */
function normalizeContent(content: string): string {
  return content
    .toLowerCase()
    .trim()
    .replace(/(.)\1{2,}/g, '$1$1') // "kkkkkkk" -> "kk", "aaaaa" -> "aa"
    .replace(/\s+/g, ' ');
}

export async function initializeChatXp(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    const roles = await ensureChatXpRoles(guild);
    if (!roles.size) continue;

    for (const userId of Object.keys(getConfig().chatXp.memberXp)) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) await updateChatXpRole(member);
    }
  }

  await flushConfigPersistence();
  console.log(`[ChatXP] ${roleCache.size} servidor(es) preparado(s).`);
}

export async function handleChatXpMessage(message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;

  const rawContent = message.content.trim();
  if (rawContent.length < MIN_MESSAGE_LENGTH) return;

  const wordCount = rawContent.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_MESSAGE_WORDS) return;

  const userId = message.author.id;
  const normalized = normalizeContent(rawContent);

  // Bloqueia se a mensagem (normalizada) já apareceu recentemente pra essa pessoa
  const history = lastMessagesByUser.get(userId) ?? [];
  if (history.includes(normalized)) return;

  const now = Date.now();
  if (now - getChatXpLastAwardAt(userId) < CHAT_XP_COOLDOWN_MS) return;

  // Trava de segurança: mesmo com mensagens diferentes, limita quantas contam por minuto
  const recentAwards = (awardTimestampsByUser.get(userId) ?? []).filter(
    (t) => now - t < AWARDS_WINDOW_MS,
  );
  if (recentAwards.length >= MAX_AWARDS_PER_WINDOW) {
    awardTimestampsByUser.set(userId, recentAwards);
    return;
  }

  lastMessagesByUser.set(userId, [normalized, ...history].slice(0, MESSAGE_HISTORY_SIZE));
  recentAwards.push(now);
  awardTimestampsByUser.set(userId, recentAwards);
  setChatXpLastAwardAt(userId, now);

  const totalXp = addChatXp(userId, CHAT_XP_PER_MESSAGE);
  await flushConfigPersistence();
  const member = message.member ?? await message.guild.members.fetch(userId).catch(() => null);
  if (member) await updateChatXpRole(member, totalXp);
}

export function getChatXpLevel(xp: number): (typeof CHAT_XP_LEVELS)[number] {
  let achieved: (typeof CHAT_XP_LEVELS)[number] = CHAT_XP_LEVELS[0];
  for (const level of CHAT_XP_LEVELS) {
    if (xp >= level.thresholdXp) achieved = level;
  }
  return achieved;
}

async function ensureChatXpRoles(guild: Guild): Promise<Map<string, Role>> {
  await guild.roles.fetch();
  const roles = new Map<string, Role>();
  const me = guild.members.me;

  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    console.error(`[ChatXP] Sem permissão para gerenciar cargos em ${guild.name}.`);
    return roles;
  }

  for (const level of CHAT_XP_LEVELS) {
    let role = getChatXpRoleId(level.key)
      ? guild.roles.cache.get(getChatXpRoleId(level.key)!)
      : undefined;
    role ??= guild.roles.cache.find((candidate) => candidate.name === level.name);

    if (!role) {
      role = await guild.roles.create({
        name: level.name,
        color: level.color,
        hoist: false,
        mentionable: false,
        reason: 'Cargos de XP por mensagens do Pet do GG',
      });
      console.log(`[ChatXP] Cargo criado: ${level.name} (${role.id})`);
    }

    setChatXpRoleId(level.key, role.id);
    roles.set(level.key, role);
  }

  roleCache.set(guild.id, { roles });
  return roles;
}

async function updateChatXpRole(
  member: GuildMember,
  knownXp = getChatXp(member.id),
): Promise<void> {
  const state = roleCache.get(member.guild.id);
  if (!state) return;

  const achieved = getChatXpLevel(knownXp);
  const achievedRole = state.roles.get(achieved.key);
  if (!achievedRole) return;

  const oldChatRoles = [...state.roles.values()].filter(
    (role) => role.id !== achievedRole.id && member.roles.cache.has(role.id),
  );

  if (oldChatRoles.length) {
    await member.roles.remove(oldChatRoles, 'Atualização de cargo por XP de chat').catch((error) => {
      console.error(`[ChatXP] Não foi possível remover cargos antigos de ${member.id}:`, error);
    });
  }

  if (!member.roles.cache.has(achievedRole.id)) {
    await member.roles.add(achievedRole, 'Atualização de cargo por XP de chat').catch((error) => {
      console.error(`[ChatXP] Não foi possível atribuir ${achievedRole.name} a ${member.id}:`, error);
    });
  }
}
