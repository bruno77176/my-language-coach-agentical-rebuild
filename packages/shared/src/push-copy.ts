import type { SupportedLang } from "./languages";

// Native-language copy for push notifications. Modeled on greetings.ts — one
// warm, friendly line per language, in Lisa's voice (the coach), never
// guilt-trippy and never AI-vs-human. Sent in the user's native language
// (profiles.nativeLang), falling back to English for any unmapped code.

export type PushKind =
  | "day-1-feedback"
  | "day-2-warmup"
  | "day-7-summary"
  | "inactivity-reminder";

export type PushCopy = { title: string; body: string };

const DEEP_LINK: Record<PushKind, string> = {
  "day-1-feedback": "mylanguagecoach:///(tabs)/practice",
  "day-2-warmup": "mylanguagecoach:///(tabs)/practice",
  "inactivity-reminder": "mylanguagecoach:///(tabs)/practice",
  "day-7-summary": "mylanguagecoach:///(tabs)/progress/weekly-summary",
};

export const PUSH_COPY: Record<PushKind, Record<SupportedLang, PushCopy>> = {
  "day-1-feedback": {
    en: {
      title: "Your first feedback is ready 🎉",
      body: "Lisa saved notes from your first session — take a look.",
    },
    fr: {
      title: "Ton premier bilan est prêt 🎉",
      body: "Lisa a noté des remarques de ta première session — jette un œil.",
    },
    de: {
      title: "Dein erstes Feedback ist da 🎉",
      body: "Lisa hat Notizen aus deiner ersten Sitzung — schau mal rein.",
    },
    it: {
      title: "Il tuo primo feedback è pronto 🎉",
      body: "Lisa ha degli appunti dalla tua prima sessione — dai un'occhiata.",
    },
    es: {
      title: "Tu primer resumen está listo 🎉",
      body: "Lisa te dejó notas de tu primera sesión — échales un vistazo.",
    },
    pt: {
      title: "O teu primeiro resumo está pronto 🎉",
      body: "A Lisa deixou notas da tua primeira sessão — dá uma olhada.",
    },
    tr: {
      title: "İlk geri bildirimin hazır 🎉",
      body: "Lisa ilk seansından notlar bıraktı — bir göz at.",
    },
    sv: {
      title: "Din första återkoppling är klar 🎉",
      body: "Lisa har anteckningar från ditt första pass — ta en titt.",
    },
    da: {
      title: "Din første feedback er klar 🎉",
      body: "Lisa har noter fra din første session — tag et kig.",
    },
    ru: {
      title: "Твой первый разбор готов 🎉",
      body: "Лиза оставила заметки после первой сессии — загляни.",
    },
    ro: {
      title: "Primul tău feedback este gata 🎉",
      body: "Lisa a notat câteva lucruri din prima ta sesiune — aruncă o privire.",
    },
    hu: {
      title: "Kész az első visszajelzésed 🎉",
      body: "Lisa jegyzeteket készített az első beszélgetésedről — nézd meg.",
    },
    ja: {
      title: "最初のフィードバックが届きました 🎉",
      body: "Lisaが最初のセッションのメモを残しました。見てみましょう。",
    },
    zh: {
      title: "你的第一份反馈来了 🎉",
      body: "Lisa 记下了你第一次练习的笔记，快看看吧。",
    },
    ko: {
      title: "첫 피드백이 도착했어요 🎉",
      body: "Lisa가 첫 세션의 메모를 남겼어요. 확인해 보세요.",
    },
  },
  "day-2-warmup": {
    en: {
      title: "5 minutes with Lisa?",
      body: "A quick chat keeps your streak going.",
    },
    fr: {
      title: "5 minutes avec Lisa ?",
      body: "Une petite conversation entretient ta série.",
    },
    de: {
      title: "5 Minuten mit Lisa?",
      body: "Ein kurzes Gespräch hält deine Serie am Leben.",
    },
    it: {
      title: "5 minuti con Lisa?",
      body: "Una chiacchierata veloce mantiene viva la tua serie.",
    },
    es: {
      title: "¿5 minutos con Lisa?",
      body: "Una charla rápida mantiene viva tu racha.",
    },
    pt: {
      title: "5 minutos com a Lisa?",
      body: "Uma conversa rápida mantém a tua sequência viva.",
    },
    tr: {
      title: "Lisa ile 5 dakika?",
      body: "Kısa bir sohbet serini canlı tutar.",
    },
    sv: {
      title: "5 minuter med Lisa?",
      body: "Ett snabbt samtal håller din svit vid liv.",
    },
    da: {
      title: "5 minutter med Lisa?",
      body: "En hurtig snak holder din stime i live.",
    },
    ru: {
      title: "5 минут с Лизой?",
      body: "Короткий разговор сохранит твою серию.",
    },
    ro: {
      title: "5 minute cu Lisa?",
      body: "O conversație scurtă îți menține seria.",
    },
    hu: {
      title: "5 perc Lisával?",
      body: "Egy rövid beszélgetés életben tartja a sorozatodat.",
    },
    ja: {
      title: "Lisaと5分いかがですか？",
      body: "短い会話で連続記録をキープ。",
    },
    zh: {
      title: "和 Lisa 聊 5 分钟？",
      body: "简短的对话让你的连续记录延续下去。",
    },
    ko: {
      title: "Lisa와 5분 어때요?",
      body: "짧은 대화가 연속 기록을 이어줘요.",
    },
  },
  "day-7-summary": {
    en: { title: "Your first week 🌱", body: "See how far you've come." },
    fr: {
      title: "Ta première semaine 🌱",
      body: "Regarde le chemin parcouru.",
    },
    de: {
      title: "Deine erste Woche 🌱",
      body: "Sieh, wie weit du gekommen bist.",
    },
    it: {
      title: "La tua prima settimana 🌱",
      body: "Guarda quanti progressi hai fatto.",
    },
    es: { title: "Tu primera semana 🌱", body: "Mira cuánto has avanzado." },
    pt: {
      title: "A tua primeira semana 🌱",
      body: "Vê o quanto já avançaste.",
    },
    tr: { title: "İlk haftan 🌱", body: "Ne kadar ilerlediğini gör." },
    sv: { title: "Din första vecka 🌱", body: "Se hur långt du har kommit." },
    da: { title: "Din første uge 🌱", body: "Se, hvor langt du er nået." },
    ru: {
      title: "Твоя первая неделя 🌱",
      body: "Посмотри, как далеко ты продвинулся.",
    },
    ro: {
      title: "Prima ta săptămână 🌱",
      body: "Vezi cât de mult ai progresat.",
    },
    hu: {
      title: "Az első heted 🌱",
      body: "Nézd meg, milyen messzire jutottál.",
    },
    ja: { title: "最初の1週間 🌱", body: "ここまでの成長を見てみましょう。" },
    zh: { title: "你的第一周 🌱", body: "看看你已经进步了多少。" },
    ko: { title: "첫 일주일 🌱", body: "얼마나 성장했는지 확인해 보세요." },
  },
  "inactivity-reminder": {
    en: {
      title: "Lisa misses you 👋",
      body: "It's been a few days — a 5-minute chat keeps your skills fresh.",
    },
    fr: {
      title: "Lisa pense à toi 👋",
      body: "Ça fait quelques jours — 5 minutes suffisent pour rester au top.",
    },
    de: {
      title: "Lisa vermisst dich 👋",
      body: "Ein paar Tage sind vergangen — 5 Minuten halten dich fit.",
    },
    it: {
      title: "Lisa ti pensa 👋",
      body: "Sono passati alcuni giorni — 5 minuti bastano per restare in forma.",
    },
    es: {
      title: "Lisa te echa de menos 👋",
      body: "Han pasado unos días — 5 minutos bastan para no perder el ritmo.",
    },
    pt: {
      title: "A Lisa tem saudades tuas 👋",
      body: "Já passaram alguns dias — 5 minutos bastam para não perderes o ritmo.",
    },
    tr: {
      title: "Lisa seni özledi 👋",
      body: "Birkaç gün oldu — 5 dakikalık sohbet seni formda tutar.",
    },
    sv: {
      title: "Lisa saknar dig 👋",
      body: "Det har gått några dagar — 5 minuter håller dig i form.",
    },
    da: {
      title: "Lisa savner dig 👋",
      body: "Der er gået et par dage — 5 minutter holder dig skarp.",
    },
    ru: {
      title: "Лиза скучает по тебе 👋",
      body: "Прошло несколько дней — 5 минут помогут не растерять навык.",
    },
    ro: {
      title: "Lisei îi este dor de tine 👋",
      body: "Au trecut câteva zile — 5 minute te țin în formă.",
    },
    hu: {
      title: "Lisa hiányol téged 👋",
      body: "Eltelt néhány nap — 5 perc, és formában maradsz.",
    },
    ja: {
      title: "Lisaが待っています 👋",
      body: "数日ぶりですね。5分の会話で感覚をキープしましょう。",
    },
    zh: {
      title: "Lisa 想你了 👋",
      body: "已经好几天啦，5 分钟的对话让你保持状态。",
    },
    ko: {
      title: "Lisa가 기다리고 있어요 👋",
      body: "며칠 지났네요. 5분 대화로 감각을 유지해요.",
    },
  },
};

/**
 * Localized push copy for a kind, in the user's native language (falls back to
 * English for unmapped codes). Returns the Expo push payload shape.
 */
export function buildPushCopy(
  kind: PushKind,
  nativeLang: string,
): { title: string; body: string; data: { url: string } } {
  const byLang = PUSH_COPY[kind];
  const copy = byLang[nativeLang as SupportedLang] ?? byLang.en;
  return { title: copy.title, body: copy.body, data: { url: DEEP_LINK[kind] } };
}
