import type { Client } from 'discord.js';

declare function attachAntispam(
  client: Client,
  channelId: string,
  options?: { reason?: string },
): () => void;

declare const antispam: {
  attachAntispam: typeof attachAntispam;
};

export default antispam;
