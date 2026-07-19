/**
 * Constantes globais do bot — IDs de cargos e canais.
 * Centralizadas aqui para evitar duplicação entre arquivos.
 */

/** Cargos de staff — podem usar /sorteio, /editar-texto e ver tickets */
export const STAFF_ROLE_IDS = [
  '1503440562211127316', // ♛ 𝑺𝒖𝒑𝒓𝒆𝒎𝒂 ♛
  '1481792319328878713', // 🜲 Thᥱ G᥆ᥲt᥉ 🜲
  '1502148024325898463', // .𖹭. 𝑬𝒒𝒖𝒊𝒑𝒆 𝒅𝒆 𝒔𝒖𝒑𝒐𝒓𝒕𝒆
  '1520888304835493888', // ⋆ 𝑪𝒐𝒐𝒓𝒅. 𝒅𝒆 𝑺𝒖𝒑𝒐𝒓𝒕𝒆 ⋆
];

/** Canal #eventos — único canal onde /sorteio pode ser usado */
export const SORTEIO_CHANNEL_ID = '1524833320658141394';

/** Canal onde o painel de tickets fica fixo */
export const TICKET_PANEL_CHANNEL_ID = '1505935902759977000';

/**
 * Verifica se a interação veio de alguém com cargo de staff.
 * Lida com os dois tipos que Discord.js pode retornar:
 *   - GuildMember          → roles é GuildMemberRoleManager (tem .cache)
 *   - APIInteractionGuildMember → roles é string[] de IDs
 */
export function interactionHasStaffRole(
  member: { roles: string[] | { cache: { has(id: string): boolean } } } | null | undefined
): boolean {
  if (!member) return false;
  const roles = member.roles;
  if (Array.isArray(roles)) {
    return STAFF_ROLE_IDS.some((id) => roles.includes(id));
  }
  return STAFF_ROLE_IDS.some((id) => roles.cache.has(id));
}
