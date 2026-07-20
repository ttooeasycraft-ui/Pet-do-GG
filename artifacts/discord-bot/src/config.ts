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
    /**
     * URL externa de imagem/banner OU vazio para usar o banner local
     * (assets/banner-boas-vindas.png, se existir).
     */
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
    text: 'Olá player novo!! Muito bom ter mais um Noob- ops, jogador conosco ✨❤️\n\n{membro} acabou de entrar!\nVocê é o nosso **{contagem}º** membro! 🐾',
    imageUrl: '', // vazio = usa banner local (assets/banner-boas-vindas.png)
  },
  ticket: {
    panelText:
      'Fale com a gente!\n\n' +
      'Tem alguma dúvida, precisa de ajuda ou quer propor uma parceria? Abra um ticket abaixo e nossa equipe te responde em breve.',
    panelImageUrl: '',
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
