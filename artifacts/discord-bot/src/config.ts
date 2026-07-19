/**
 * Gerenciador de configuração persistente do bot.
 * Lê e escreve em data/config.json (relativo ao cwd do processo).
 *
 * Persistência:
 *   - Replit dev: sobrevive a restarts do workflow ✅
 *   - Railway:    sobrevive a restarts do container ✅
 *                 resetada a cada novo deploy (recompilar imagem) ⚠️
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_PATH = join(process.cwd(), 'data', 'config.json');

export interface BotConfig {
  welcome: {
    /** Texto da descrição do embed. Suporta {membro}, {servidor}, {contagem} */
    text: string;
    /** URL opcional de imagem/banner exibida no embed de boas-vindas */
    imageUrl: string;
  };
  ticket: {
    /** Texto da descrição do painel de tickets */
    panelText: string;
    /** URL opcional da imagem/GIF do painel */
    panelImageUrl: string;
    /** ID da última mensagem de painel enviada pelo bot (para edição direta) */
    panelMessageId: string;
    /** ID do canal onde o painel foi enviado */
    panelChannelId: string;
  };
}

export const DEFAULTS: BotConfig = {
  welcome: {
    text:
      'Bem-vindo(a), {membro}!\n' +
      'Você acabou de chegar em **{servidor}**.\n\n' +
      'Você é o nosso **{contagem}º** membro! 🐾',
    imageUrl: '',
  },
  ticket: {
    panelText:
      '💬 **Fale com a gente!**\n' +
      'Se você está com alguma dúvida, precisa de ajuda ou quer conversar sobre uma possível parceria, estamos aqui pra você! 🤝✨\n\n' +
      '📩 Abra um ticket e explique direitinho o que você precisa — nossa equipe vai te responder o mais rápido possível e te dar todo o suporte necessário. 🚀\n\n' +
      '🛠️ Seja suporte técnico, dúvidas gerais ou propostas de parceria, pode contar com a gente! Não tenha vergonha de chamar, estamos sempre prontos pra ajudar. 💙',
    panelImageUrl: 'https://media.tenor.com/LCBfnMGLV6UAAAAC/sad-poop-emoji.gif',
    panelMessageId: '',
    panelChannelId: '',
  },
};

let _config: BotConfig = deepMerge(DEFAULTS, {});

function deepMerge(defaults: BotConfig, saved: Partial<BotConfig>): BotConfig {
  return {
    welcome: { ...defaults.welcome, ...(saved.welcome ?? {}) },
    ticket:  { ...defaults.ticket,  ...(saved.ticket  ?? {}) },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function loadConfig(): void {
  try {
    if (existsSync(CONFIG_PATH)) {
      const saved = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Partial<BotConfig>;
      _config = deepMerge(DEFAULTS, saved);
      console.log('[Config] Carregada de', CONFIG_PATH);
    } else {
      console.log('[Config] Nenhum arquivo salvo — usando valores padrão.');
    }
  } catch (err) {
    console.warn('[Config] Erro ao carregar config, usando padrões:', err);
  }
}

export function getConfig(): Readonly<BotConfig> {
  return _config;
}

export function setWelcome(text: string, imageUrl: string): void {
  _config.welcome.text     = text;
  _config.welcome.imageUrl = imageUrl;
  persist();
}

export function setTicketPanelText(text: string, imageUrl: string): void {
  _config.ticket.panelText     = text;
  _config.ticket.panelImageUrl = imageUrl;
  persist();
}

export function setTicketPanelMessage(messageId: string, channelId: string): void {
  _config.ticket.panelMessageId = messageId;
  _config.ticket.panelChannelId = channelId;
  persist();
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function persist(): void {
  try {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(_config, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Config] Erro ao salvar config:', err);
  }
}
