import type { SupportedLang } from "./languages";

export const GREETING_TEMPLATES: Record<SupportedLang, string> = {
  en: "Hi {name}! What would you like to talk about today?",
  fr: "Salut {name} ! De quoi veux-tu parler aujourd'hui ?",
  de: "Hallo {name}! Worüber möchtest du heute sprechen?",
  it: "Ciao {name}! Di cosa vuoi parlare oggi?",
  es: "¡Hola {name}! ¿De qué quieres hablar hoy?",
  pt: "Olá {name}! Sobre o que queres falar hoje?",
  tr: "Merhaba {name}! Bugün ne hakkında konuşmak istersin?",
  sv: "Hej {name}! Vad vill du prata om idag?",
  da: "Hej {name}! Hvad vil du tale om i dag?",
  ru: "Привет, {name}! О чём хочешь поговорить сегодня?",
  ro: "Bună, {name}! Despre ce vrei să vorbim astăzi?",
  hu: "Szia {name}! Miről szeretnél ma beszélni?",
  ja: "こんにちは、{name}さん！今日は何について話しましょうか？",
  zh: "你好，{name}！今天你想聊些什么？",
  ko: "안녕하세요, {name}님! 오늘은 무엇에 대해 이야기하고 싶으세요?",
};

export function buildGreeting(lang: SupportedLang, name: string): string {
  return GREETING_TEMPLATES[lang].replace("{name}", name);
}
