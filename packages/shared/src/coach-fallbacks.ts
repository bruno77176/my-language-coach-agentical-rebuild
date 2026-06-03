import type { SupportedLang } from "./languages";

export type SoftErrorCode =
  | "AUDIO_SILENT"
  | "AUDIO_TOO_SHORT"
  | "STT_PROVIDER_FAILURE"
  | "LLM_PROVIDER_FAILURE"
  | "TTS_PROVIDER_FAILURE";

type FallbackMap = Record<SoftErrorCode, string>;

export const COACH_FALLBACKS: Record<SupportedLang, FallbackMap> = {
  en: {
    AUDIO_SILENT: "Hmm, I didn't catch that — could you try again?",
    AUDIO_TOO_SHORT: "That was a bit too short — give it another go!",
    STT_PROVIDER_FAILURE: "I'm having trouble hearing — could you repeat?",
    LLM_PROVIDER_FAILURE: "Something on my end glitched — let's keep going.",
    TTS_PROVIDER_FAILURE: "(Audio failed — read my message above.)",
  },
  fr: {
    AUDIO_SILENT: "Hmm, je n'ai pas entendu — tu peux répéter ?",
    AUDIO_TOO_SHORT: "C'était un peu court — essaie encore !",
    STT_PROVIDER_FAILURE: "J'ai du mal à entendre — répète s'il te plaît ?",
    LLM_PROVIDER_FAILURE: "Petit bug de mon côté — on continue.",
    TTS_PROVIDER_FAILURE: "(L'audio a échoué — lis mon message ci-dessus.)",
  },
  de: {
    AUDIO_SILENT: "Hmm, das habe ich nicht gehört — kannst du es wiederholen?",
    AUDIO_TOO_SHORT: "Das war etwas zu kurz — versuch es noch einmal!",
    STT_PROVIDER_FAILURE: "Ich höre dich schlecht — kannst du es wiederholen?",
    LLM_PROVIDER_FAILURE:
      "Bei mir ist etwas schiefgelaufen — machen wir weiter.",
    TTS_PROVIDER_FAILURE: "(Audio fehlgeschlagen — lies meine Nachricht oben.)",
  },
  it: {
    AUDIO_SILENT: "Hmm, non ho sentito — puoi ripetere?",
    AUDIO_TOO_SHORT: "Era un po' troppo breve — riprova!",
    STT_PROVIDER_FAILURE: "Ho difficoltà a sentirti — ripeti per favore?",
    LLM_PROVIDER_FAILURE: "Piccolo problema da parte mia — andiamo avanti.",
    TTS_PROVIDER_FAILURE: "(Audio non riuscito — leggi il messaggio sopra.)",
  },
  es: {
    AUDIO_SILENT: "Hmm, no te escuché — ¿puedes intentarlo de nuevo?",
    AUDIO_TOO_SHORT: "Fue un poco corto — ¡inténtalo otra vez!",
    STT_PROVIDER_FAILURE: "Me cuesta oírte — ¿puedes repetirlo?",
    LLM_PROVIDER_FAILURE: "Algo falló de mi lado — sigamos.",
    TTS_PROVIDER_FAILURE: "(Audio falló — lee mi mensaje arriba.)",
  },
  pt: {
    AUDIO_SILENT: "Hmm, não ouvi — podes tentar de novo?",
    AUDIO_TOO_SHORT: "Foi um bocadinho curto — tenta outra vez!",
    STT_PROVIDER_FAILURE: "Tenho dificuldade em ouvir — podes repetir?",
    LLM_PROVIDER_FAILURE: "Algo correu mal aqui — vamos continuar.",
    TTS_PROVIDER_FAILURE: "(Áudio falhou — lê a minha mensagem acima.)",
  },
  tr: {
    AUDIO_SILENT: "Hmm, duyamadım — tekrar dener misin?",
    AUDIO_TOO_SHORT: "Biraz kısaydı — bir daha dene!",
    STT_PROVIDER_FAILURE: "Seni duymakta zorlanıyorum — tekrar eder misin?",
    LLM_PROVIDER_FAILURE: "Benim tarafımda bir sorun oldu — devam edelim.",
    TTS_PROVIDER_FAILURE: "(Ses başarısız oldu — yukarıdaki mesajımı oku.)",
  },
  sv: {
    AUDIO_SILENT: "Hmm, jag hörde inte — kan du försöka igen?",
    AUDIO_TOO_SHORT: "Det var lite för kort — försök igen!",
    STT_PROVIDER_FAILURE: "Jag har svårt att höra — kan du upprepa?",
    LLM_PROVIDER_FAILURE: "Något strulade hos mig — vi fortsätter.",
    TTS_PROVIDER_FAILURE: "(Ljudet misslyckades — läs mitt meddelande ovan.)",
  },
  da: {
    AUDIO_SILENT: "Hmm, jeg hørte det ikke — kan du prøve igen?",
    AUDIO_TOO_SHORT: "Det var lidt for kort — prøv igen!",
    STT_PROVIDER_FAILURE: "Jeg har svært ved at høre — kan du gentage?",
    LLM_PROVIDER_FAILURE: "Noget gik galt hos mig — vi fortsætter.",
    TTS_PROVIDER_FAILURE: "(Lyden mislykkedes — læs min besked ovenfor.)",
  },
  ru: {
    AUDIO_SILENT: "Хм, я не расслышал — повтори, пожалуйста?",
    AUDIO_TOO_SHORT: "Слишком коротко — попробуй ещё раз!",
    STT_PROVIDER_FAILURE: "Мне трудно расслышать — повтори?",
    LLM_PROVIDER_FAILURE: "У меня небольшой сбой — продолжим.",
    TTS_PROVIDER_FAILURE: "(Аудио не удалось — прочти моё сообщение выше.)",
  },
  ro: {
    AUDIO_SILENT: "Hmm, n-am auzit — poți să încerci din nou?",
    AUDIO_TOO_SHORT: "A fost cam scurt — mai încearcă o dată!",
    STT_PROVIDER_FAILURE: "Am dificultăți să te aud — poți repeta?",
    LLM_PROVIDER_FAILURE: "Ceva s-a stricat de la mine — continuăm.",
    TTS_PROVIDER_FAILURE: "(Audio eșuat — citește mesajul meu de sus.)",
  },
  hu: {
    AUDIO_SILENT: "Hmm, nem hallottam — meg tudnád próbálni újra?",
    AUDIO_TOO_SHORT: "Kicsit rövid volt — próbáld meg újra!",
    STT_PROVIDER_FAILURE: "Nehezen hallak — meg tudnád ismételni?",
    LLM_PROVIDER_FAILURE: "Valami nem stimmelt nálam — folytassuk.",
    TTS_PROVIDER_FAILURE: "(Hang sikertelen — olvasd a fenti üzenetem.)",
  },
  ja: {
    AUDIO_SILENT:
      "うーん、うまく聞き取れませんでした — もう一度お願いできますか？",
    AUDIO_TOO_SHORT: "少し短すぎました — もう一度試してみてください！",
    STT_PROVIDER_FAILURE: "うまく聞き取れません — もう一度言ってもらえますか？",
    LLM_PROVIDER_FAILURE: "こちらで少し不具合がありました — 続けましょう。",
    TTS_PROVIDER_FAILURE:
      "（音声に失敗しました — 上のメッセージをお読みください。）",
  },
  zh: {
    AUDIO_SILENT: "嗯，我没听清楚 — 可以再说一遍吗？",
    AUDIO_TOO_SHORT: "有点太短了 — 再试一次吧！",
    STT_PROVIDER_FAILURE: "我有点听不清 — 可以重复一遍吗？",
    LLM_PROVIDER_FAILURE: "我这边出了点小问题 — 我们继续吧。",
    TTS_PROVIDER_FAILURE: "（音频播放失败 — 请阅读我上面的消息。）",
  },
  ko: {
    AUDIO_SILENT: "음, 잘 못 들었어요 — 다시 한번 말씀해 주시겠어요?",
    AUDIO_TOO_SHORT: "조금 너무 짧았어요 — 다시 한번 해보세요!",
    STT_PROVIDER_FAILURE: "잘 들리지 않네요 — 다시 말씀해 주시겠어요?",
    LLM_PROVIDER_FAILURE: "제 쪽에서 문제가 좀 생겼어요 — 계속 진행해요.",
    TTS_PROVIDER_FAILURE:
      "(오디오 재생에 실패했어요 — 위의 메시지를 읽어 주세요.)",
  },
};

export function getCoachFallback(
  lang: SupportedLang,
  code: SoftErrorCode,
): string {
  const map = COACH_FALLBACKS[lang] ?? COACH_FALLBACKS.en;
  return map[code];
}
