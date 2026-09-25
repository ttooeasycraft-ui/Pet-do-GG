import {
  Client,
  Guild,
  GuildMember,
  PermissionFlagsBits,
  Role,
  VoiceState,
} from 'discord.js';

import {
  addVoiceXpSeconds,
  getConfig,
  getVoiceXpRoleId,
  getVoiceXpSeconds,
  setVoiceXpRoleId,
} from '../config.js';

export const VOICE_XP_LEVELS = [
  { key: 'bronze', name: 'Bronze', thresholdHours: 0, color: 0xcd7f32 },
  { key: 'prata', name: 'Prata', thresholdHours: 5, color: 0xc0c0c0 },
  { key: 'ouro', name: 'Ouro', thresholdHours: 15, color: 0xffd700 },
  { key: 'platina', name: 'Platina', thresholdHours: 30, color: 0x65e5d3 },
  { key: 'diamante', name: 'Diamante', thresholdHours: 50, color: 0x55d7ff },
  { key: 'mestre', name: 'Mestre', thresholdHours: 80, color: 0x9b59b6 },
  { key: 'grao_mestre', name: 'Grão-Mestre', thresholdHours: 120, color: 0xf1c40f },
  { key: 'top_500', name: 'Top 500 (200+)', thresholdHours: 200, color: 0xff4d6d },
] as const;

interface ActiveVoiceSession {
  guildId: string;
  joinedAt: number;
}

const activeSessions = new Map<string, ActiveVoiceSession>();
const roleCache = new Map<string, Map<string, Role>>();

function sessionKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export async function initializeVoiceXp(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    const roles = await ensureVoiceXpRoles(guild);
    if (!roles.size) continue;

    for (const userId of Object.keys(getConfig().voiceXp.memberSeconds)) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) await updateVoiceXpRole(member);
    }

    for (const voiceState of guild.voiceStates.cache.values()) {
      if (voiceState.channelId && voiceState.member && !voiceState.member.user.bot) {
        activeSessions.set(sessionKey(guild.id, voiceState.id), {
          guildId: guild.id,
          joinedAt: Date.now(),
        });
        await updateVoiceXpRole(voiceState.member);
      }
    }
  }

  console.log(`[VoiceXP] ${roleCache.size} servidor(es) preparado(s).`);
}

export async function handleVoiceXpStateUpdate(
  oldState: VoiceState,
  newState: VoiceState,
): Promise<void> {
  if (oldState.channelId === newState.channelId) return;

  const guild = newState.guild ?? oldState.guild;
  const userId = newState.id;
  const member = newState.member ?? oldState.member;
  if (member?.user.bot) return;

  if (oldState.channelId) {
    await finishVoiceSession(guild, userId);
  }

  if (newState.channelId) {
    activeSessions.set(sessionKey(guild.id, userId), {
      guildId: guild.id,
      joinedAt: Date.now(),
    });
    const joinedMember =
      newState.member ?? await guild.members.fetch(userId).catch(() => null);
    if (joinedMember) await updateVoiceXpRole(joinedMember);
  }
}

async function ensureVoiceXpRoles(guild: Guild): Promise<Map<string, Role>> {
  await guild.roles.fetch();
  const roles = new Map<string, Role>();
  const me = guild.members.me;

  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    console.error(`[VoiceXP] Sem permissão para gerenciar cargos em ${guild.name}.`);
    return roles;
  }

  for (const level of VOICE_XP_LEVELS) {
    let role = getVoiceXpRoleId(level.key)
      ? guild.roles.cache.get(getVoiceXpRoleId(level.key)!)
      : undefined;
    role ??= guild.roles.cache.find((candidate) => candidate.name === level.name);

    if (!role) {
      role = await guild.roles.create({
        name: level.name,
        color: level.color,
        hoist: false,
        mentionable: false,
        reason: 'Cargos de XP por tempo em call do Pet do GG',
      });
      console.log(`[VoiceXP] Cargo criado: ${level.name} (${role.id})`);
    }

    setVoiceXpRoleId(level.key, role.id);
    roles.set(level.key, role);
  }

  roleCache.set(guild.id, roles);
  return roles;
}

async function finishVoiceSession(guild: Guild, userId: string): Promise<void> {
  const key = sessionKey(guild.id, userId);
  const session = activeSessions.get(key);
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!session) {
    if (member) await updateVoiceXpRole(member);
    return;
  }

  activeSessions.delete(key);
  const elapsedSeconds = Math.floor((Date.now() - session.joinedAt) / 1_000);
  const totalSeconds = addVoiceXpSeconds(userId, elapsedSeconds);
  if (member) await updateVoiceXpRole(member, totalSeconds);
}

export function getVoiceXpLevel(seconds: number): (typeof VOICE_XP_LEVELS)[number] {
  const totalHours = seconds / 3_600;
  let achieved: (typeof VOICE_XP_LEVELS)[number] = VOICE_XP_LEVELS[0];
  for (const level of VOICE_XP_LEVELS) {
    if (totalHours >= level.thresholdHours) achieved = level;
  }
  return achieved;
}

async function updateVoiceXpRole(
  member: GuildMember,
  knownSeconds = getVoiceXpSeconds(member.id),
): Promise<void> {
  const roles = roleCache.get(member.guild.id);
  if (!roles) return;

  const achieved = getVoiceXpLevel(knownSeconds);
  const achievedRole = roles.get(achieved.key);
  if (!achievedRole) return;

  const oldXpRoles = [...roles.values()].filter(
    (role) => role.id !== achievedRole.id && member.roles.cache.has(role.id),
  );

  if (oldXpRoles.length) {
    await member.roles.remove(oldXpRoles, 'Atualização de cargo por XP de call').catch((error) => {
      console.error(`[VoiceXP] Não foi possível remover cargos antigos de ${member.id}:`, error);
    });
  }

  if (!member.roles.cache.has(achievedRole.id)) {
    await member.roles.add(achievedRole, 'Atualização de cargo por XP de call').catch((error) => {
      console.error(`[VoiceXP] Não foi possível atribuir ${achievedRole.name} a ${member.id}:`, error);
    });
  }
}