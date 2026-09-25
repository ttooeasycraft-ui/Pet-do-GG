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
  getChatXp,
  getChatXpLastAwardAt,
  getChatXpRoleId,
  getConfig,
  setChatXpLastAwardAt,
  setChatXpRoleId,
} from '../config.js';

const CHAT_XP_PER_MESSAGE = 1;
const CHAT_XP_COOLDOWN_MS = 60_000;
const MIN_MESSAGE_LENGTH = 3;

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
const lastMessageByUser = new Map<string, string>();

export async function initializeChatXp(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    const roles = await ensureChatXpRoles(guild);
    if (!roles.size) continue;

    for (const userId of Object.keys(getConfig().chatXp.memberXp)) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) await updateChatXpRole(member);
    }
  }

  console.log(`[ChatXP] ${roleCache.size} servidor(es) preparado(s).`);
}

export async function handleChatXpMessage(message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;

  const content = message.content.trim();
  if (content.length < MIN_MESSAGE_LENGTH) return;

  const previousContent = lastMessageByUser.get(message.author.id);
  if (previousContent === content) return;

  const now = Date.now();
  if (now - getChatXpLastAwardAt(message.author.id) < CHAT_XP_COOLDOWN_MS) {
    return;
  }

  lastMessageByUser.set(message.author.id, content);
  setChatXpLastAwardAt(message.author.id, now);

  const totalXp = addChatXp(message.author.id, CHAT_XP_PER_MESSAGE);
  const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null);
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