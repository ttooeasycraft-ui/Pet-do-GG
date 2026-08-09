import { VoiceChannel, VoiceState } from 'discord.js';

const GENERAL_CALL_TIMEOUT_MS = 60_000;

interface GeneralCallState {
  channel: VoiceChannel;
  used: boolean;
  firstJoinTimer: NodeJS.Timeout;
}

const generalCalls = new Map<string, GeneralCallState>();

/**
 * Registra uma call criada pelo painel geral.
 *
 * Calls de ticket nunca passam por este rastreador: elas ficam abertas até
 * que o ticket seja fechado.
 */
export function trackGeneralCall(channel: VoiceChannel): void {
  const firstJoinTimer = setTimeout(() => {
    const state = generalCalls.get(channel.id);
    if (!state) return;

    if (channel.members.size > 0) {
      state.used = true;
      return;
    }

    deleteGeneralCall(channel.id, 'ninguém entrou nos primeiros 60 segundos');
  }, GENERAL_CALL_TIMEOUT_MS);

  firstJoinTimer.unref();
  generalCalls.set(channel.id, { channel, used: false, firstJoinTimer });
}

/**
 * Monitora apenas as calls gerais registradas por trackGeneralCall.
 *
 * Ao primeiro ingresso, o prazo de um minuto é cancelado. Depois que a call
 * já foi usada, o último participante a sair dispara a exclusão.
 */
export function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState,
): void {
  const joinedCallId = newState.channelId;
  const leftCallId = oldState.channelId;

  if (joinedCallId) {
    const joinedCall = generalCalls.get(joinedCallId);
    if (joinedCall) {
      joinedCall.used = true;
      clearTimeout(joinedCall.firstJoinTimer);
    }
  }

  if (!leftCallId || leftCallId === joinedCallId) return;

  const leftCall = generalCalls.get(leftCallId);
  if (!leftCall || leftCall.used === false) return;

  if (leftCall.channel.members.size === 0) {
    deleteGeneralCall(leftCallId, 'a call ficou vazia após ter sido usada');
  }
}

function deleteGeneralCall(channelId: string, reason: string): void {
  const state = generalCalls.get(channelId);
  if (!state) return;

  generalCalls.delete(channelId);
  clearTimeout(state.firstJoinTimer);

  state.channel
    .delete(`Call geral excluída: ${reason}`)
    .then(() => console.log(`[Voice] Call geral excluída — ${channelId} — ${reason}`))
    .catch((error) => {
      console.error(`[Voice] Não foi possível excluir a call geral ${channelId}:`, error);
    });
}