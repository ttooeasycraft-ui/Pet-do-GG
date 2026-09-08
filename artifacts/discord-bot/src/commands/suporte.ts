import {
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Message,
  MessageFlags,
  TextChannel,
} from 'discord.js';

import { interactionHasStaffRole } from '../constants.js';
import {
  getConfig,
  getSupportTimeout,
  refreshSupportTimeout,
  removeSupportTimeout,
  setSupportTimeout,
} from '../config.js';
import {
  closeTicketChannel,
  isTicketChannel,
  ticketOwnerId,
} from './ticket.js';

const MAX_TIMER_DELAY = 2_147_000_000;
const timers = new Map<string, NodeJS.Timeout>();

type SupportTimeUnit = 'segundos' | 'minutos' | 'horas' | 'dias' | 'meses' | 'anos';

const UNIT_LABELS: Record<SupportTimeUnit, string> = {
  segundos: 'segundo(s)',
  minutos: 'minuto(s)',
  horas: 'hora(s)',
  dias: 'dia(s)',
  meses: 'mês(es)',
  anos: 'ano(s)',
};

function hasSupportPermission(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member as Parameters<typeof interactionHasStaffRole>[0];
  return interaction.guild?.ownerId === interaction.user.id || interactionHasStaffRole(member);
}

function durationToMilliseconds(amount: number, unit: SupportTimeUnit): number {
  const multipliers: Record<SupportTimeUnit, number> = {
    segundos: 1_000,
    minutos: 60_000,
    horas: 60 * 60_000,
    dias: 24 * 60 * 60_000,
    meses: 30 * 24 * 60 * 60_000,
    anos: 365 * 24 * 60 * 60_000,
  };
  return amount * multipliers[unit];
}

export async function handleSupportTimeout(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!hasSupportPermission(interaction)) {
    await interaction.reply({
      content: 'Apenas a dona ou a equipe autorizada pode configurar o tempo de suporte.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedChannel = interaction.options.getChannel('canal', true);
  const amount = interaction.options.getInteger('tempo', true);
  const unit = interaction.options.getString('unidade', true) as SupportTimeUnit;

  if (selectedChannel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: 'Escolha um canal de texto de ticket.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channel = selectedChannel as TextChannel;
  const ownerId = ticketOwnerId(channel);
  if (!isTicketChannel(channel) || !ownerId) {
    await interaction.reply({
      content: 'Escolha um canal de ticket aberto. O prazo acompanha a resposta do dono desse ticket.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const timeoutMs = durationToMilliseconds(amount, unit);
  setSupportTimeout(channel.id, timeoutMs, interaction.user.id);
  scheduleSupportTimeout(interaction.client, channel.id);

  await interaction.reply({
    content:
      `✅ Tempo de suporte configurado para <#${channel.id}>.\n` +
      `Se <@${ownerId}> ficar sem responder por **${amount} ${UNIT_LABELS[unit]}**, ` +
      'o ticket será fechado automaticamente. Cada nova resposta do membro reinicia o prazo.',
    flags: MessageFlags.Ephemeral,
  });
}

export async function initializeSupportTimeouts(client: Client): Promise<void> {
  const configured = [...getConfig().ticket.supportTimeouts];
  for (const entry of configured) {
    const channel = await client.channels.fetch(entry.channelId).catch(() => null);
    if (!(channel instanceof TextChannel) || !isTicketChannel(channel)) {
      removeSupportTimeout(entry.channelId);
      continue;
    }
    scheduleSupportTimeout(client, entry.channelId);
  }
  console.log(`[SupportTimeout] ${configured.length} configuração(ões) carregada(s).`);
}

export function handleSupportMessage(message: Message): void {
  if (message.author.bot || !message.guild || !(message.channel instanceof TextChannel)) return;

  const setting = getSupportTimeout(message.channel.id);
  if (!setting || !isTicketChannel(message.channel)) return;

  const ownerId = ticketOwnerId(message.channel);
  if (!ownerId || ownerId !== message.author.id) return;

  refreshSupportTimeout(message.channel.id);
  scheduleSupportTimeout(message.client, message.channel.id);
}

function scheduleSupportTimeout(client: Client, channelId: string): void {
  const current = getSupportTimeout(channelId);
  if (!current) return;

  const previousTimer = timers.get(channelId);
  if (previousTimer) clearTimeout(previousTimer);

  const remaining = current.dueAt - Date.now();
  const delay = Math.min(Math.max(remaining, 1), MAX_TIMER_DELAY);
  const timer = setTimeout(() => {
    timers.delete(channelId);
    void expireSupportTimeout(client, channelId);
  }, delay);
  timer.unref();
  timers.set(channelId, timer);
}

async function expireSupportTimeout(client: Client, channelId: string): Promise<void> {
  const current = getSupportTimeout(channelId);
  if (!current) return;

  if (current.dueAt > Date.now()) {
    scheduleSupportTimeout(client, channelId);
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  removeSupportTimeout(channelId);
  if (!(channel instanceof TextChannel) || !isTicketChannel(channel)) return;

  const ownerId = ticketOwnerId(channel);
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('⏰ Ticket fechado por inatividade')
        .setDescription(
          ownerId
            ? `<@${ownerId}>, este atendimento foi encerrado porque não houve resposta dentro do prazo.`
            : 'Este atendimento foi encerrado porque não houve resposta dentro do prazo.',
        )
        .setColor(0xed4245)
        .setFooter({ text: 'Pet do GG · Fechamento automático de suporte' }),
    ],
  }).catch(() => null);

  await closeTicketChannel(
    channel,
    client.user?.id ?? current.configuredBy,
    'Ticket fechado automaticamente por inatividade',
  );
}