const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

function attachAntispam(client, channelId, options = {}) {
  if (!client || typeof client.on !== 'function' || typeof client.off !== 'function') {
    throw new TypeError('É necessário passar um cliente Discord válido.');
  }
  if (!SNOWFLAKE_PATTERN.test(String(channelId))) {
    throw new TypeError('Informe o ID numérico do canal para ativar o antispam.');
  }

  const reason = options.reason ?? 'Banimento automático: mensagem enviada no canal restrito.';

  const onMessage = async (message) => {
    if (
      message.author?.bot ||
      !message.guild ||
      message.channelId !== String(channelId)
    ) {
      return;
    }

    try {
      await message.guild.members.ban(message.author.id, { reason });
    } catch (error) {
      console.error(
        `[Antispam] Não foi possível banir um membro no canal configurado (${error?.name ?? 'erro'}).`,
      );
    }
  };

  client.on('messageCreate', onMessage);
  return () => client.off('messageCreate', onMessage);
}

module.exports = { attachAntispam };
