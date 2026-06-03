import type { SupportedLang } from "./languages";

export type { SupportedLang } from "./languages";

export type DailyQuote = {
  /** Stable kebab-case id, e.g. "wittgenstein-grenzen". */
  id: string;
  /** The quote in its original language. lang may be ANY language code,
   *  including ones not in SupportedLang (e.g. "la" Latin, "iu" Inuktitut). */
  original: {
    lang: string;
    /** Display name of the original language, e.g. "German", "Latin". */
    langDisplayName: string;
    /** Flag emoji (or empty string if no clear flag). */
    flag: string;
    text: string;
  };
  /** "— Wittgenstein", "— Tao Te Ching", etc. */
  attribution: string;
  /** Pre-baked translations into all 12 supported languages. Required. */
  translations: Record<SupportedLang, string>;
};

export const DAILY_QUOTES: readonly DailyQuote[] = [
  // 1 — German / Wittgenstein
  {
    id: "wittgenstein-grenzen",
    original: {
      lang: "de",
      langDisplayName: "German",
      flag: "🇩🇪",
      text: "Die Grenzen meiner Sprache bedeuten die Grenzen meiner Welt.",
    },
    attribution: "Ludwig Wittgenstein",
    translations: {
      en: "The limits of my language mean the limits of my world.",
      fr: "Les limites de ma langue signifient les limites de mon monde.",
      de: "Die Grenzen meiner Sprache bedeuten die Grenzen meiner Welt.",
      it: "I limiti del mio linguaggio sono i limiti del mio mondo.",
      es: "Los límites de mi lenguaje son los límites de mi mundo.",
      pt: "Os limites da minha linguagem são os limites do meu mundo.",
      tr: "Dilimin sınırları, dünyamın sınırlarıdır.",
      sv: "Mitt språks gränser är min världs gränser.",
      da: "Grænserne for mit sprog er grænserne for min verden.",
      ru: "Границы моего языка — это границы моего мира.",
      ro: "Limitele limbajului meu sunt limitele lumii mele.",
      hu: "Nyelvem határai világom határait jelentik.",
      ja: "私の言語の限界は、私の世界の限界を意味する。",
      zh: "我的语言的界限意味着我的世界的界限。",
      ko: "내 언어의 한계는 내 세계의 한계를 의미한다.",
    },
  },

  // 2 — Latin / Seneca
  {
    id: "seneca-docendo-discimus",
    original: {
      lang: "la",
      langDisplayName: "Latin",
      flag: "",
      text: "Docendo discimus.",
    },
    attribution: "Seneca",
    translations: {
      en: "We learn by teaching.",
      fr: "On apprend en enseignant.",
      de: "Wir lernen, indem wir lehren.",
      it: "Si impara insegnando.",
      es: "Aprendemos enseñando.",
      pt: "Aprendemos ensinando.",
      tr: "Öğreterek öğreniriz.",
      sv: "Vi lär oss genom att undervisa.",
      da: "Vi lærer ved at undervise.",
      ru: "Мы учимся, обучая других.",
      ro: "Învățăm predând.",
      hu: "Tanítva tanulunk.",
      ja: "教えることで、私たちは学ぶ。",
      zh: "教学相长，我们在教导中学习。",
      ko: "우리는 가르치면서 배운다.",
    },
  },

  // 3 — Mandarin Chinese / Confucius
  {
    id: "confucius-learn-think",
    original: {
      lang: "zh",
      langDisplayName: "Classical Chinese",
      flag: "🇨🇳",
      text: "學而不思則罔，思而不學則殆。",
    },
    attribution: "Confucius, Analects",
    translations: {
      en: "Learning without thought is labor lost; thought without learning is perilous.",
      fr: "Apprendre sans réfléchir est vain ; réfléchir sans apprendre est dangereux.",
      de: "Lernen ohne Nachdenken ist vergebliche Mühe; Nachdenken ohne Lernen ist Gefahr.",
      it: "Imparare senza riflettere è inutile; riflettere senza imparare è pericoloso.",
      es: "Aprender sin reflexionar es inútil; reflexionar sin aprender es peligroso.",
      pt: "Aprender sem pensar é trabalho perdido; pensar sem aprender é perigoso.",
      tr: "Düşünmeden öğrenmek boşunadır; öğrenmeden düşünmek tehlikelidir.",
      sv: "Att lära utan att tänka är förlorat arbete; att tänka utan att lära är farligt.",
      da: "At lære uden at tænke er spildt arbejde; at tænke uden at lære er farligt.",
      ru: "Учиться без размышления — бесполезно; размышлять без учения — опасно.",
      ro: "A învăța fără a gândi este muncă pierdută; a gândi fără a învăța este periculos.",
      hu: "Tanulni gondolkodás nélkül hiábavaló; gondolkodni tanulás nélkül veszélyes.",
      ja: "学びて思わざれば則ち罔し、思いて学ばざれば則ち殆し。",
      zh: "学而不思则罔，思而不学则殆。",
      ko: "배우기만 하고 생각하지 않으면 얻는 것이 없고, 생각만 하고 배우지 않으면 위태롭다.",
    },
  },

  // 4 — Arabic / Ibn Battuta
  {
    id: "ibn-battuta-travel",
    original: {
      lang: "ar",
      langDisplayName: "Arabic",
      flag: "🌙",
      text: "السفر يترك المرء أخرس، ثم يجعله راوية.",
    },
    attribution: "Ibn Battuta",
    translations: {
      en: "Traveling leaves you speechless, then turns you into a storyteller.",
      fr: "Le voyage vous laisse sans voix, puis il fait de vous un conteur.",
      de: "Reisen lässt dich sprachlos — und macht dich dann zum Geschichtenerzähler.",
      it: "Il viaggio ti lascia senza parole, poi ti trasforma in un narratore.",
      es: "Viajar te deja sin palabras, y luego te convierte en un narrador.",
      pt: "Viajar deixa-te sem palavras e depois transforma-te num contador de histórias.",
      tr: "Seyahat sizi önce dilsiz bırakır, sonra bir hikâyeci yapar.",
      sv: "Resande gör dig först tyst och sedan till en berättare.",
      da: "Rejsen gør dig først mundlam og forvandler dig derefter til en historiefortæller.",
      ru: "Путешествие сначала лишает тебя слов, а потом делает рассказчиком.",
      ro: "Călătoria te lasă mai întâi fără cuvinte, apoi te transformă într-un povestitor.",
      hu: "Az utazás előbb elnémít, aztán mesélővé tesz.",
      ja: "旅はあなたを言葉を失わせ、それから語り部に変える。",
      zh: "旅行先让你无言以对，然后把你变成一个讲故事的人。",
      ko: "여행은 당신을 말문이 막히게 하고, 그런 다음 이야기꾼으로 만든다.",
    },
  },

  // 5 — Japanese / Basho
  {
    id: "basho-journey",
    original: {
      lang: "ja",
      langDisplayName: "Japanese",
      flag: "🇯🇵",
      text: "旅に病んで 夢は枯野を かけめぐる。",
    },
    attribution: "Matsuo Bashō",
    translations: {
      en: "Sick on my journey, yet my dreams roam over withered fields.",
      fr: "Malade en voyage, mes rêves errent pourtant sur des champs desséchés.",
      de: "Krank auf meiner Reise, wandern meine Träume doch über welke Felder.",
      it: "Malato in viaggio, i miei sogni vagano ancora su campi appassiti.",
      es: "Enfermo en mi camino, mis sueños aún vagan por campos marchitos.",
      pt: "Doente em minha jornada, meus sonhos vagam por campos murchos.",
      tr: "Yolculuğumda hasta olsam da düşlerim solmuş tarlaları dolaşır.",
      sv: "Sjuk på min resa, ändå vandrar mina drömmar över vissnade fält.",
      da: "Syg på min rejse, men mine drømme vandrer over visne marker.",
      ru: "В пути я болен, но мои сны блуждают по увядшим полям.",
      ro: "Bolnav în drumul meu, visele mele rătăcesc totuși pe câmpuri ofilite.",
      hu: "Betegen az úton, álmaim mégis hervadt mezőkön bolyonganak.",
      ja: "旅に病んで夢は枯野をかけめぐる。",
      zh: "羁旅卧病，梦魂仍在枯野上奔驰。",
      ko: "여행길에 병들었으나, 내 꿈은 마른 들판을 헤맨다.",
    },
  },

  // 6 — Finnish / proverb
  {
    id: "proverb-finnish-silence",
    original: {
      lang: "fi",
      langDisplayName: "Finnish",
      flag: "🇫🇮",
      text: "Hyvä kello kauas kuuluu, paha vielä kauemmaksi.",
    },
    attribution: "Finnish proverb",
    translations: {
      en: "A good bell is heard far, a bad one farther still.",
      fr: "Une bonne cloche s'entend de loin, une mauvaise encore plus loin.",
      de: "Eine gute Glocke ist weit zu hören, eine schlechte noch weiter.",
      it: "Una buona campana si sente lontano, una cattiva ancora più lontano.",
      es: "Una buena campana se oye lejos, una mala aún más lejos.",
      pt: "Um bom sino ouve-se de longe, um mau ainda mais longe.",
      tr: "İyi çan uzaktan duyulur, kötüsü daha da uzaktan.",
      sv: "En god klocka hörs långt, en dålig ännu längre.",
      da: "En god klokke høres langt, en dårlig endnu længere.",
      ru: "Хороший колокол слышен издалека, плохой — ещё дальше.",
      ro: "Un clopot bun se aude departe, unul rău și mai departe.",
      hu: "A jó harang messzire hallatszik, a rossz még messzebbre.",
      ja: "良い鐘は遠くまで響き、悪い鐘はさらに遠くまで響く。",
      zh: "好钟传得远，坏钟传得更远。",
      ko: "좋은 종소리는 멀리 들리고, 나쁜 종소리는 더 멀리 들린다.",
    },
  },

  // 7 — Sanskrit / Upanishads
  {
    id: "upanishads-aham-brahmasmi",
    original: {
      lang: "sa",
      langDisplayName: "Sanskrit",
      flag: "",
      text: "अहं ब्रह्मास्मि।",
    },
    attribution: "Brihadaranyaka Upanishad",
    translations: {
      en: "I am Brahman — I am the ultimate reality.",
      fr: "Je suis Brahman — je suis la réalité ultime.",
      de: "Ich bin Brahman — ich bin die höchste Wirklichkeit.",
      it: "Io sono Brahman — io sono la realtà ultima.",
      es: "Yo soy Brahman — yo soy la realidad última.",
      pt: "Eu sou Brahman — eu sou a realidade última.",
      tr: "Ben Brahman'ım — ben nihai gerçekliğim.",
      sv: "Jag är Brahman — jag är den yttersta verkligheten.",
      da: "Jeg er Brahman — jeg er den ultimative virkelighed.",
      ru: "Я есмь Брахман — я есть высшая реальность.",
      ro: "Eu sunt Brahman — eu sunt realitatea supremă.",
      hu: "Én vagyok Brahman — én vagyok a végső valóság.",
      ja: "我はブラフマンなり——我は究極の実在なり。",
      zh: "我即梵——我即终极的实在。",
      ko: "나는 브라만이다——나는 궁극의 실재이다.",
    },
  },

  // 8 — French / Voltaire
  {
    id: "voltaire-jugez-homme",
    original: {
      lang: "fr",
      langDisplayName: "French",
      flag: "🇫🇷",
      text: "Jugez un homme par ses questions plutôt que par ses réponses.",
    },
    attribution: "Voltaire",
    translations: {
      en: "Judge a man by his questions rather than by his answers.",
      fr: "Jugez un homme par ses questions plutôt que par ses réponses.",
      de: "Beurteile einen Menschen eher nach seinen Fragen als nach seinen Antworten.",
      it: "Giudica un uomo dalle sue domande piuttosto che dalle sue risposte.",
      es: "Juzga a un hombre por sus preguntas más que por sus respuestas.",
      pt: "Julgue um homem pelas suas perguntas, não pelas suas respostas.",
      tr: "Bir insanı cevaplarından çok sorularına göre yargılayın.",
      sv: "Döm en man efter hans frågor snarare än hans svar.",
      da: "Bedøm en mand efter hans spørgsmål snarere end hans svar.",
      ru: "Судите о человеке по его вопросам, а не по ответам.",
      ro: "Judecă un om după întrebările sale, nu după răspunsurile sale.",
      hu: "Egy embert a kérdései alapján ítélj meg, nem a válaszai alapján.",
      ja: "人を判断するには、その答えよりもその問いによってせよ。",
      zh: "评判一个人，要看他的问题，而不是他的回答。",
      ko: "사람을 판단할 때는 그의 답이 아니라 그의 질문으로 하라.",
    },
  },

  // 9 — Swahili / proverb
  {
    id: "proverb-swahili-haraka",
    original: {
      lang: "sw",
      langDisplayName: "Swahili",
      flag: "",
      text: "Haraka haraka haina baraka.",
    },
    attribution: "Swahili proverb",
    translations: {
      en: "Hurry, hurry has no blessing.",
      fr: "La précipitation n'a pas de bénédiction.",
      de: "Eile, Eile hat keinen Segen.",
      it: "La fretta, la fretta non porta fortuna.",
      es: "Las prisas no tienen bendición.",
      pt: "A pressa não tem bênção.",
      tr: "Acele acelenin bereketi yoktur.",
      sv: "Brådska, brådska har ingen välsignelse.",
      da: "Hast, hast har ingen velsignelse.",
      ru: "Спешка, спешка — без благодати.",
      ro: "Graba, graba nu are binecuvântare.",
      hu: "A sietség sietségnek nincs áldása.",
      ja: "急ぎに急ぎても、そこに恵みはない。",
      zh: "匆匆忙忙，没有福气。",
      ko: "서두르고 서둘러도 복은 없다.",
    },
  },

  // 10 — Ancient Greek / Heraclitus
  {
    id: "heraclitus-panta-rhei",
    original: {
      lang: "grc",
      langDisplayName: "Ancient Greek",
      flag: "",
      text: "Πάντα ῥεῖ.",
    },
    attribution: "Heraclitus",
    translations: {
      en: "Everything flows.",
      fr: "Tout s'écoule.",
      de: "Alles fließt.",
      it: "Tutto scorre.",
      es: "Todo fluye.",
      pt: "Tudo flui.",
      tr: "Her şey akar.",
      sv: "Allt flödar.",
      da: "Alt flyder.",
      ru: "Всё течёт.",
      ro: "Totul curge.",
      hu: "Minden folyik.",
      ja: "万物は流転する。",
      zh: "万物皆流。",
      ko: "만물은 흐른다.",
    },
  },

  // 11 — Russian / Chekhov
  {
    id: "chekhov-knowledge",
    original: {
      lang: "ru",
      langDisplayName: "Russian",
      flag: "🇷🇺",
      text: "Знание только тогда знание, когда оно приобретено усилиями своей мысли.",
    },
    attribution: "Anton Chekhov",
    translations: {
      en: "Knowledge is only knowledge when it has been acquired by one's own thought.",
      fr: "La connaissance n'est vraie connaissance que lorsqu'elle est acquise par sa propre pensée.",
      de: "Wissen ist nur dann Wissen, wenn es durch eigenes Denken erworben wurde.",
      it: "La conoscenza è vera conoscenza solo quando è acquisita con il proprio pensiero.",
      es: "El conocimiento solo es conocimiento cuando ha sido adquirido por el propio pensamiento.",
      pt: "O conhecimento só é conhecimento quando adquirido pelo próprio pensamento.",
      tr: "Bilgi, ancak kendi düşüncesiyle kazanıldığında bilgidir.",
      sv: "Kunskap är bara kunskap när den förvärvats genom eget tänkande.",
      da: "Viden er kun viden, når den er erhvervet gennem ens egne tanker.",
      ru: "Знание только тогда знание, когда оно приобретено усилиями своей мысли.",
      ro: "Cunoașterea este cunoaștere doar când este dobândită prin propriul efort de gândire.",
      hu: "A tudás csak akkor tudás, ha saját gondolkodás erőfeszítésével szereztük.",
      ja: "知識は、自らの思考の努力によって得られたときにのみ、真の知識となる。",
      zh: "只有通过自己思考的努力获得的知识，才是真正的知识。",
      ko: "지식은 스스로의 사고의 노력으로 얻었을 때에만 비로소 지식이다.",
    },
  },

  // 12 — Yoruba / proverb
  {
    id: "proverb-yoruba-river",
    original: {
      lang: "yo",
      langDisplayName: "Yoruba",
      flag: "",
      text: "Omi tó bá fẹ́ rìn, a máa ń wá ọ̀nà.",
    },
    attribution: "Yoruba proverb",
    translations: {
      en: "Water that wants to flow always finds a path.",
      fr: "L'eau qui veut couler trouve toujours un chemin.",
      de: "Wasser, das fließen will, findet immer einen Weg.",
      it: "L'acqua che vuole scorrere trova sempre un cammino.",
      es: "El agua que quiere fluir siempre encuentra un camino.",
      pt: "A água que quer fluir sempre encontra um caminho.",
      tr: "Akmak isteyen su her zaman bir yol bulur.",
      sv: "Vatten som vill rinna hittar alltid en väg.",
      da: "Vand, der vil flyde, finder altid en vej.",
      ru: "Вода, которая хочет течь, всегда найдёт путь.",
      ro: "Apa care vrea să curgă își găsește întotdeauna o cale.",
      hu: "A víz, amely folyni akar, mindig talál utat.",
      ja: "流れようとする水は、必ず道を見つける。",
      zh: "想要流动的水，总会找到出路。",
      ko: "흐르고자 하는 물은 언제나 길을 찾는다.",
    },
  },

  // 13 — Spanish / Cervantes
  {
    id: "cervantes-camino-al-andar",
    original: {
      lang: "es",
      langDisplayName: "Spanish",
      flag: "🇪🇸",
      text: "Caminante, son tus huellas el camino y nada más.",
    },
    attribution: "Antonio Machado",
    translations: {
      en: "Wanderer, your footprints are the road and nothing more.",
      fr: "Voyageur, tes empreintes sont le chemin et rien de plus.",
      de: "Wanderer, deine Fußspuren sind der Weg und nichts weiter.",
      it: "Viandante, le tue orme sono il cammino e nient'altro.",
      es: "Caminante, son tus huellas el camino y nada más.",
      pt: "Caminhante, são tuas pegadas o caminho e nada mais.",
      tr: "Yolcu, senin izlerin yoldur ve başka bir şey değildir.",
      sv: "Vandrare, dina fotspår är vägen och inget annat.",
      da: "Vandringsmand, dine fodspor er vejen og intet andet.",
      ru: "Странник, твои следы — это и есть путь, и ничего более.",
      ro: "Călătorule, urmele tale sunt calea și nimic altceva.",
      hu: "Vándor, a te lábnyomaid az út, és semmi más.",
      ja: "旅人よ、君の足跡こそが道であり、それ以外の何ものでもない。",
      zh: "行路人啊，你的足迹就是道路，别无其他。",
      ko: "나그네여, 그대의 발자국이 곧 길이며 그 외에는 아무것도 아니다.",
    },
  },

  // 14 — Italian / Dante
  {
    id: "dante-amor-che-move",
    original: {
      lang: "it",
      langDisplayName: "Italian",
      flag: "🇮🇹",
      text: "L'amor che move il sole e l'altre stelle.",
    },
    attribution: "Dante Alighieri, Paradiso",
    translations: {
      en: "The love that moves the sun and all the other stars.",
      fr: "L'amour qui meut le soleil et les autres étoiles.",
      de: "Die Liebe, die die Sonne und die anderen Sterne bewegt.",
      it: "L'amor che move il sole e l'altre stelle.",
      es: "El amor que mueve el sol y las demás estrellas.",
      pt: "O amor que move o sol e as outras estrelas.",
      tr: "Güneşi ve diğer yıldızları harekete geçiren aşk.",
      sv: "Kärleken som rör solen och alla de andra stjärnorna.",
      da: "Kærligheden, der bevæger solen og alle de andre stjerner.",
      ru: "Любовь, что движет солнцем и другими звёздами.",
      ro: "Iubirea care mișcă soarele și celelalte stele.",
      hu: "A szeretet, amely mozgatja a napot és a többi csillagot.",
      ja: "太陽と他のすべての星々を動かす愛。",
      zh: "那推动太阳和其他群星的爱。",
      ko: "태양과 다른 모든 별들을 움직이는 사랑.",
    },
  },

  // 15 — Portuguese / Pessoa
  {
    id: "pessoa-navigare-necesse",
    original: {
      lang: "pt",
      langDisplayName: "Portuguese",
      flag: "🇵🇹",
      text: "Navegar é preciso; viver não é preciso.",
    },
    attribution: "Fernando Pessoa (after Pompey)",
    translations: {
      en: "To navigate is necessary; to live is not necessary.",
      fr: "Naviguer est nécessaire ; vivre ne l'est pas.",
      de: "Navigieren ist notwendig; leben ist nicht notwendig.",
      it: "Navigare è necessario; vivere non è necessario.",
      es: "Navegar es necesario; vivir no es necesario.",
      pt: "Navegar é preciso; viver não é preciso.",
      tr: "Yelken açmak zorunludur; yaşamak zorunlu değildir.",
      sv: "Att navigera är nödvändigt; att leva är det inte.",
      da: "At navigere er nødvendigt; at leve er det ikke.",
      ru: "Плавать необходимо; жить — нет.",
      ro: "A naviga este necesar; a trăi nu este necesar.",
      hu: "Hajózni szükséges; élni nem szükséges.",
      ja: "航海することは必要だ。生きることは必要ではない。",
      zh: "航行是必要的；活着并非必要。",
      ko: "항해하는 것은 필요하다; 사는 것은 필요하지 않다.",
    },
  },

  // 16 — Turkish / proverb
  {
    id: "proverb-turkish-dil",
    original: {
      lang: "tr",
      langDisplayName: "Turkish",
      flag: "🇹🇷",
      text: "Dil, kalbin aynasıdır.",
    },
    attribution: "Turkish proverb",
    translations: {
      en: "Language is the mirror of the heart.",
      fr: "La langue est le miroir du cœur.",
      de: "Die Sprache ist der Spiegel des Herzens.",
      it: "La lingua è lo specchio del cuore.",
      es: "La lengua es el espejo del corazón.",
      pt: "A língua é o espelho do coração.",
      tr: "Dil, kalbin aynasıdır.",
      sv: "Språket är hjärtats spegel.",
      da: "Sproget er hjertets spejl.",
      ru: "Язык — зеркало сердца.",
      ro: "Limba este oglinda inimii.",
      hu: "A nyelv a szív tükre.",
      ja: "言葉は心の鏡である。",
      zh: "语言是心灵的镜子。",
      ko: "언어는 마음의 거울이다.",
    },
  },

  // 17 — Hebrew / Talmud
  {
    id: "talmud-seal-of-truth",
    original: {
      lang: "he",
      langDisplayName: "Hebrew",
      flag: "🇮🇱",
      text: "חוֹתָמוֹ שֶׁל הַקָּדוֹשׁ בָּרוּךְ הוּא אֱמֶת.",
    },
    attribution: "Talmud, Shabbat 55a",
    translations: {
      en: "The seal of the Holy One is truth.",
      fr: "Le sceau du Saint est la vérité.",
      de: "Das Siegel des Heiligen ist die Wahrheit.",
      it: "Il sigillo del Santo è la verità.",
      es: "El sello del Santo es la verdad.",
      pt: "O selo do Santo é a verdade.",
      tr: "Kutsal Olan'ın mührü hakikattir.",
      sv: "Den Heliges sigill är sanning.",
      da: "Den Helliges segl er sandhed.",
      ru: "Печать Святого — это истина.",
      ro: "Pecetea Sfântului este adevărul.",
      hu: "A Szentnek pecsétje az igazság.",
      ja: "聖なる御方の印は真実である。",
      zh: "至圣者的印记是真理。",
      ko: "거룩하신 분의 인장은 진리이다.",
    },
  },

  // 18 — Persian / Rumi
  {
    id: "rumi-silence-ocean",
    original: {
      lang: "fa",
      langDisplayName: "Persian",
      flag: "🇮🇷",
      text: "خاموشی دریایی‌ست بی‌پایان.",
    },
    attribution: "Jalāl al-Dīn Rūmī",
    translations: {
      en: "Silence is an ocean without end.",
      fr: "Le silence est un océan sans fin.",
      de: "Stille ist ein Ozean ohne Ende.",
      it: "Il silenzio è un oceano senza fine.",
      es: "El silencio es un océano sin fin.",
      pt: "O silêncio é um oceano sem fim.",
      tr: "Sessizlik sonsuz bir okyanustur.",
      sv: "Tystnaden är ett hav utan ände.",
      da: "Stilheden er et hav uden ende.",
      ru: "Тишина — это бесконечный океан.",
      ro: "Tăcerea este un ocean fără sfârșit.",
      hu: "A csend végtelen óceán.",
      ja: "沈黙は果てしない海である。",
      zh: "沉默是一片无边无际的海洋。",
      ko: "침묵은 끝없는 바다이다.",
    },
  },

  // 19 — Korean / Sejong era saying
  {
    id: "korean-proverb-words",
    original: {
      lang: "ko",
      langDisplayName: "Korean",
      flag: "🇰🇷",
      text: "말 한마디로 천 냥 빚을 갚는다.",
    },
    attribution: "Korean proverb",
    translations: {
      en: "A single word can repay a debt of a thousand coins.",
      fr: "Un seul mot peut rembourser une dette de mille pièces.",
      de: "Ein einziges Wort kann eine Schuld von tausend Münzen begleichen.",
      it: "Una sola parola può saldare un debito di mille monete.",
      es: "Una sola palabra puede saldar una deuda de mil monedas.",
      pt: "Uma única palavra pode saldar uma dívida de mil moedas.",
      tr: "Tek bir söz bin altın borcu öder.",
      sv: "Ett enda ord kan återbetala en skuld på tusen mynt.",
      da: "Et enkelt ord kan betale en gæld på tusind mønter.",
      ru: "Одно слово может погасить долг в тысячу монет.",
      ro: "Un singur cuvânt poate achita o datorie de o mie de monede.",
      hu: "Egyetlen szó ezer arany adósságot törleszthet.",
      ja: "一言で千両の借金を返すこともできる。",
      zh: "一句话能偿还千两的债务。",
      ko: "말 한마디로 천 냥 빚을 갚는다.",
    },
  },

  // 20 — Māori / whakataukī
  {
    id: "maori-whakatauki-people",
    original: {
      lang: "mi",
      langDisplayName: "Māori",
      flag: "🇳🇿",
      text: "He aha te mea nui o te ao? He tāngata, he tāngata, he tāngata.",
    },
    attribution: "Māori whakataukī (proverb)",
    translations: {
      en: "What is the greatest thing in the world? It is people, it is people, it is people.",
      fr: "Quelle est la plus grande chose du monde ? Ce sont les gens, les gens, les gens.",
      de: "Was ist das Größte der Welt? Es sind die Menschen, die Menschen, die Menschen.",
      it: "Qual è la cosa più grande del mondo? Sono le persone, le persone, le persone.",
      es: "¿Cuál es la cosa más grande del mundo? Son las personas, las personas, las personas.",
      pt: "Qual é a maior coisa do mundo? São as pessoas, as pessoas, as pessoas.",
      tr: "Dünyanın en büyük şeyi nedir? İnsanlardır, insanlardır, insanlardır.",
      sv: "Vad är det största i världen? Det är människorna, människorna, människorna.",
      da: "Hvad er det største i verden? Det er menneskene, menneskene, menneskene.",
      ru: "Что есть величайшее в мире? Это люди, люди, люди.",
      ro: "Care este cel mai mare lucru din lume? Sunt oamenii, oamenii, oamenii.",
      hu: "Mi a világ legnagyobb dolga? Az emberek, az emberek, az emberek.",
      ja: "この世で最も大切なものは何か。それは人、人、そして人である。",
      zh: "世界上最重要的是什么？是人，是人，还是人。",
      ko: "세상에서 가장 위대한 것은 무엇인가? 그것은 사람이요, 사람이요, 사람이다.",
    },
  },

  // 21 — Inuktitut / proverb
  {
    id: "proverb-inuit-patience",
    original: {
      lang: "iu",
      langDisplayName: "Inuktitut",
      flag: "",
      text: "ᐊᑏᑦ ᓴᕿᑎᑦᑎᕙᒃᑐᑦ ᐊᑏᑦᑕᕐᓂᑯᑦ.",
    },
    attribution: "Inuit proverb",
    translations: {
      en: "Patience always brings its own reward.",
      fr: "La patience apporte toujours sa récompense.",
      de: "Geduld bringt immer ihre eigene Belohnung.",
      it: "La pazienza porta sempre la propria ricompensa.",
      es: "La paciencia siempre trae su propia recompensa.",
      pt: "A paciência sempre traz sua própria recompensa.",
      tr: "Sabır her zaman kendi ödülünü getirir.",
      sv: "Tålamod ger alltid sin egen belöning.",
      da: "Tålmodighed bringer altid sin egen belønning.",
      ru: "Терпение всегда приносит свою награду.",
      ro: "Răbdarea îți aduce întotdeauna propria recompensă.",
      hu: "A türelem mindig meghozza a maga jutalmát.",
      ja: "忍耐は常にそれ自身の報いをもたらす。",
      zh: "耐心总会带来它自己的回报。",
      ko: "인내는 언제나 그 자체의 보상을 가져온다.",
    },
  },

  // 22 — Vietnamese / proverb
  {
    id: "proverb-vietnamese-learning",
    original: {
      lang: "vi",
      langDisplayName: "Vietnamese",
      flag: "🇻🇳",
      text: "Học, học nữa, học mãi.",
    },
    attribution: "Vietnamese proverb (attributed to Lenin in Vietnam)",
    translations: {
      en: "Learn, learn more, keep learning.",
      fr: "Apprendre, apprendre encore, apprendre toujours.",
      de: "Lernen, noch mehr lernen, immer weiter lernen.",
      it: "Imparare, imparare ancora, imparare sempre.",
      es: "Aprender, aprender más, seguir aprendiendo.",
      pt: "Aprender, aprender mais, continuar aprendendo.",
      tr: "Öğren, daha fazla öğren, hep öğren.",
      sv: "Lär dig, lär dig mer, fortsätt alltid att lära dig.",
      da: "Lær, lær mere, bliv ved med at lære.",
      ru: "Учись, учись ещё, учись всегда.",
      ro: "Învață, învață mai mult, învață mereu.",
      hu: "Tanulj, tanulj többet, tanulj mindig.",
      ja: "学べ、もっと学べ、学び続けよ。",
      zh: "学习，再学习，永远学习。",
      ko: "배우고, 더 배우고, 영원히 배우라.",
    },
  },

  // 23 — Quechua / proverb
  {
    id: "proverb-quechua-hands",
    original: {
      lang: "qu",
      langDisplayName: "Quechua",
      flag: "",
      text: "Mana llankaqqa, mana mikhunqachu.",
    },
    attribution: "Quechua proverb",
    translations: {
      en: "One who does not work shall not eat.",
      fr: "Celui qui ne travaille pas ne mangera pas.",
      de: "Wer nicht arbeitet, wird nicht essen.",
      it: "Chi non lavora non mangerà.",
      es: "El que no trabaja no comerá.",
      pt: "Quem não trabalha não comerá.",
      tr: "Çalışmayan yemeyecektir.",
      sv: "Den som inte arbetar ska inte äta.",
      da: "Den, der ikke arbejder, skal ikke spise.",
      ru: "Кто не работает, тот не ест.",
      ro: "Cine nu muncește nu va mânca.",
      hu: "Aki nem dolgozik, nem eszik.",
      ja: "働かざる者、食うべからず。",
      zh: "不劳动者，不得食。",
      ko: "일하지 않는 자는 먹지도 말라.",
    },
  },

  // 24 — Old English / Beowulf
  {
    id: "beowulf-words-endure",
    original: {
      lang: "ang",
      langDisplayName: "Old English",
      flag: "",
      text: "Wyrd bið ful aræd.",
    },
    attribution: "Beowulf",
    translations: {
      en: "Fate is wholly inexorable.",
      fr: "Le destin est absolument inflexible.",
      de: "Das Schicksal ist völlig unabwendbar.",
      it: "Il destino è del tutto inesorabile.",
      es: "El destino es completamente inexorable.",
      pt: "O destino é totalmente inexorável.",
      tr: "Kader kesinlikle kaçınılmazdır.",
      sv: "Ödet är fullständigt oundvikligt.",
      da: "Skæbnen er fuldstændig uafvendelig.",
      ru: "Судьба совершенно неотвратима.",
      ro: "Soarta este cu totul inexorabilă.",
      hu: "A sors teljességgel megmásíthatatlan.",
      ja: "運命はまったく避けがたいものである。",
      zh: "命运是完全无法抗拒的。",
      ko: "운명은 전적으로 피할 수 없는 것이다.",
    },
  },

  // 25 — Swedish / Astrid Lindgren
  {
    id: "lindgren-childhood-word",
    original: {
      lang: "sv",
      langDisplayName: "Swedish",
      flag: "🇸🇪",
      text: "Det finns magi i ord och om du sätter dem rätt kan de förändra världen.",
    },
    attribution: "Astrid Lindgren",
    translations: {
      en: "There is magic in words, and if you put them right, they can change the world.",
      fr: "Il y a de la magie dans les mots, et si vous les placez bien, ils peuvent changer le monde.",
      de: "Es liegt Magie in Worten, und wenn du sie richtig einsetzt, können sie die Welt verändern.",
      it: "C'è magia nelle parole, e se le metti bene, possono cambiare il mondo.",
      es: "Hay magia en las palabras, y si las pones bien, pueden cambiar el mundo.",
      pt: "Há magia nas palavras, e se as colocarmos bem, elas podem mudar o mundo.",
      tr: "Kelimelerde sihir vardır ve onları doğru yerleştirirseniz dünyayı değiştirebilirler.",
      sv: "Det finns magi i ord och om du sätter dem rätt kan de förändra världen.",
      da: "Der er magi i ord, og hvis du placerer dem rigtigt, kan de forandre verden.",
      ru: "В словах есть магия, и если правильно их расставить, они могут изменить мир.",
      ro: "Există magie în cuvinte, și dacă le pui bine, ele pot schimba lumea.",
      hu: "Varázslat rejlik a szavakban, és ha helyesen helyezed el őket, megváltoztathatják a világot.",
      ja: "言葉には魔法がある。正しく並べれば、それは世界を変えることができる。",
      zh: "文字中蕴含着魔力，若你恰当地运用它们，便能改变世界。",
      ko: "말에는 마법이 있어, 그것을 올바르게 놓으면 세상을 바꿀 수 있다.",
    },
  },

  // 26 — Danish / Kierkegaard
  {
    id: "kierkegaard-life-understood",
    original: {
      lang: "da",
      langDisplayName: "Danish",
      flag: "🇩🇰",
      text: "Livet kan kun forstås baglæns, men det må leves forlæns.",
    },
    attribution: "Søren Kierkegaard",
    translations: {
      en: "Life can only be understood backwards, but it must be lived forwards.",
      fr: "La vie ne peut être comprise qu'en regardant en arrière, mais elle doit être vécue en regardant en avant.",
      de: "Das Leben kann nur rückwärts verstanden, aber nur vorwärts gelebt werden.",
      it: "La vita può essere capita solo guardando indietro, ma deve essere vissuta guardando avanti.",
      es: "La vida solo puede entenderse mirando hacia atrás, pero debe vivirse mirando hacia adelante.",
      pt: "A vida só pode ser compreendida olhando para trás, mas deve ser vivida olhando para a frente.",
      tr: "Hayat yalnızca geriye bakarak anlaşılabilir, ama ileri bakarak yaşanmalıdır.",
      sv: "Livet kan bara förstås bakåt, men det måste levas framåt.",
      da: "Livet kan kun forstås baglæns, men det må leves forlæns.",
      ru: "Жизнь можно понять, только оглядываясь назад, но прожить её нужно, смотря вперёд.",
      ro: "Viața poate fi înțeleasă doar privind înapoi, dar trebuie trăită privind înainte.",
      hu: "Az élet csak visszafelé tekintve érthető meg, de előre tekintve kell megélni.",
      ja: "人生は振り返ってのみ理解できるが、前を向いて生きなければならない。",
      zh: "人生只能向后理解，但必须向前去活。",
      ko: "인생은 거꾸로 돌아볼 때에만 이해할 수 있지만, 앞을 향해 살아야 한다.",
    },
  },

  // 27 — Romanian / proverb
  {
    id: "proverb-romanian-word",
    original: {
      lang: "ro",
      langDisplayName: "Romanian",
      flag: "🇷🇴",
      text: "Vorba dulce mult aduce.",
    },
    attribution: "Romanian proverb",
    translations: {
      en: "A sweet word brings much.",
      fr: "Une douce parole apporte beaucoup.",
      de: "Ein sanftes Wort bringt viel.",
      it: "Una parola dolce porta molto.",
      es: "Una palabra dulce trae mucho.",
      pt: "Uma palavra doce traz muito.",
      tr: "Tatlı söz çok şey getirir.",
      sv: "Ett milt ord ger mycket.",
      da: "Et sødt ord bringer meget.",
      ru: "Мягкое слово многое приносит.",
      ro: "Vorba dulce mult aduce.",
      hu: "Az édes szó sokat hoz.",
      ja: "優しい言葉は多くをもたらす。",
      zh: "良言一句暖人心，益处多多。",
      ko: "다정한 말 한마디가 많은 것을 가져온다.",
    },
  },

  // 28 — Hungarian / proverb
  {
    id: "proverb-hungarian-patience",
    original: {
      lang: "hu",
      langDisplayName: "Hungarian",
      flag: "🇭🇺",
      text: "Lassan járj, tovább érsz.",
    },
    attribution: "Hungarian proverb",
    translations: {
      en: "Go slowly and you will go further.",
      fr: "Avancez lentement et vous irez plus loin.",
      de: "Gehe langsam und du wirst weiter kommen.",
      it: "Vai piano e arriverai più lontano.",
      es: "Ve despacio y llegarás más lejos.",
      pt: "Vai devagar e chegarás mais longe.",
      tr: "Yavaş git, daha uzağa ulaşırsın.",
      sv: "Gå långsamt och du kommer längre.",
      da: "Gå langsomt, og du kommer længere.",
      ru: "Иди медленно — дойдёшь дальше.",
      ro: "Mergi încet și vei ajunge mai departe.",
      hu: "Lassan járj, tovább érsz.",
      ja: "ゆっくり進めば、より遠くまで行ける。",
      zh: "走得慢，才能走得更远。",
      ko: "천천히 가면 더 멀리 간다.",
    },
  },

  // 29 — Latin / Caesar (adapted)
  {
    id: "caesar-veni-vidi-vici",
    original: {
      lang: "la",
      langDisplayName: "Latin",
      flag: "",
      text: "Veni, vidi, vici.",
    },
    attribution: "Julius Caesar",
    translations: {
      en: "I came, I saw, I conquered.",
      fr: "Je suis venu, j'ai vu, j'ai vaincu.",
      de: "Ich kam, ich sah, ich siegte.",
      it: "Venni, vidi, vinsi.",
      es: "Vine, vi, vencí.",
      pt: "Vim, vi, venci.",
      tr: "Geldim, gördüm, yendim.",
      sv: "Jag kom, jag såg, jag segrade.",
      da: "Jeg kom, jeg så, jeg sejrede.",
      ru: "Пришёл, увидел, победил.",
      ro: "Am venit, am văzut, am cucerit.",
      hu: "Jöttem, láttam, győztem.",
      ja: "来た、見た、勝った。",
      zh: "我来，我见，我征服。",
      ko: "왔노라, 보았노라, 이겼노라.",
    },
  },

  // 30 — Mandarin / Laozi (Tao Te Ching)
  {
    id: "laozi-journey-step",
    original: {
      lang: "zh",
      langDisplayName: "Classical Chinese",
      flag: "🇨🇳",
      text: "千里之行，始於足下。",
    },
    attribution: "Laozi, Tao Te Ching",
    translations: {
      en: "A journey of a thousand miles begins with a single step.",
      fr: "Un voyage de mille lieues commence par un seul pas.",
      de: "Eine Reise von tausend Meilen beginnt mit einem einzigen Schritt.",
      it: "Un viaggio di mille miglia comincia con un solo passo.",
      es: "Un viaje de mil millas comienza con un solo paso.",
      pt: "Uma jornada de mil milhas começa com um único passo.",
      tr: "Bin millik yolculuk tek bir adımla başlar.",
      sv: "En resa på tusen mil börjar med ett enda steg.",
      da: "En rejse på tusind mil begynder med et enkelt skridt.",
      ru: "Путь в тысячу ли начинается с первого шага.",
      ro: "O călătorie de o mie de mile începe cu un singur pas.",
      hu: "Az ezer mérföldes út egyetlen lépéssel kezdődik.",
      ja: "千里の道も一歩から始まる。",
      zh: "千里之行，始于足下。",
      ko: "천 리 길도 한 걸음부터 시작된다.",
    },
  },

  // 31 — Greek / Socrates (via Plato)
  {
    id: "socrates-know-thyself",
    original: {
      lang: "grc",
      langDisplayName: "Ancient Greek",
      flag: "",
      text: "Γνῶθι σεαυτόν.",
    },
    attribution: "Delphic maxim, cited by Socrates",
    translations: {
      en: "Know thyself.",
      fr: "Connais-toi toi-même.",
      de: "Erkenne dich selbst.",
      it: "Conosci te stesso.",
      es: "Conócete a ti mismo.",
      pt: "Conhece-te a ti mesmo.",
      tr: "Kendini bil.",
      sv: "Känn dig själv.",
      da: "Kend dig selv.",
      ru: "Познай самого себя.",
      ro: "Cunoaște-te pe tine însuți.",
      hu: "Ismerd meg önmagad.",
      ja: "汝自身を知れ。",
      zh: "认识你自己。",
      ko: "너 자신을 알라.",
    },
  },

  // 32 — Japanese / Zen saying
  {
    id: "zen-beginner-mind",
    original: {
      lang: "ja",
      langDisplayName: "Japanese",
      flag: "🇯🇵",
      text: "初心忘るべからず。",
    },
    attribution: "Zeami Motokiyo (Zen principle)",
    translations: {
      en: "Never forget the beginner's mind.",
      fr: "Ne jamais oublier l'esprit du débutant.",
      de: "Vergiss niemals den Geist des Anfängers.",
      it: "Non dimenticare mai la mente del principiante.",
      es: "Nunca olvides la mente del principiante.",
      pt: "Nunca esqueça a mente do iniciante.",
      tr: "Başlangıç zihnini asla unutma.",
      sv: "Glöm aldrig nybörjarens sinne.",
      da: "Glem aldrig begyndernes sind.",
      ru: "Никогда не забывай ум новичка.",
      ro: "Nu uita niciodată mintea începătorului.",
      hu: "Soha ne felejtsd el a kezdő szellemét.",
      ja: "初心忘るべからず。",
      zh: "莫忘初心。",
      ko: "초심을 결코 잊지 말라.",
    },
  },

  // 33 — Arabic / proverb
  {
    id: "proverb-arabic-tongue",
    original: {
      lang: "ar",
      langDisplayName: "Arabic",
      flag: "🌙",
      text: "اللسان سيف قاطع، والصمت درع واقية.",
    },
    attribution: "Arabic proverb",
    translations: {
      en: "The tongue is a sharp sword; silence is a protective shield.",
      fr: "La langue est une épée tranchante ; le silence est un bouclier protecteur.",
      de: "Die Zunge ist ein scharfes Schwert; Schweigen ist ein schützender Schild.",
      it: "La lingua è una spada affilata; il silenzio è uno scudo protettivo.",
      es: "La lengua es una espada afilada; el silencio es un escudo protector.",
      pt: "A língua é uma espada afiada; o silêncio é um escudo protetor.",
      tr: "Dil keskin bir kılıçtır; sessizlik ise koruyucu bir kalkandır.",
      sv: "Tungan är ett vasst svärd; tystnad är en skyddande sköld.",
      da: "Tungen er et skarpt sværd; stilhed er et beskyttende skjold.",
      ru: "Язык — острый меч; молчание — защитный щит.",
      ro: "Limba este o sabie ascuțită; tăcerea este un scut protector.",
      hu: "A nyelv éles kard; a hallgatás védőpajzs.",
      ja: "舌は鋭い剣であり、沈黙は身を守る盾である。",
      zh: "舌头是一把利剑，沉默是一面护盾。",
      ko: "혀는 날카로운 칼이요, 침묵은 보호하는 방패이다.",
    },
  },

  // 34 — French / Proust
  {
    id: "proust-discovery-voyage",
    original: {
      lang: "fr",
      langDisplayName: "French",
      flag: "🇫🇷",
      text: "Le véritable voyage de découverte ne consiste pas à chercher de nouveaux paysages, mais à avoir de nouveaux yeux.",
    },
    attribution: "Marcel Proust",
    translations: {
      en: "The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.",
      fr: "Le véritable voyage de découverte ne consiste pas à chercher de nouveaux paysages, mais à avoir de nouveaux yeux.",
      de: "Die wahre Entdeckungsreise besteht nicht darin, neue Landschaften zu suchen, sondern neue Augen zu haben.",
      it: "Il vero viaggio di scoperta non consiste nel cercare nuovi paesaggi, ma nell'avere nuovi occhi.",
      es: "El verdadero viaje de descubrimiento no consiste en buscar nuevos paisajes, sino en tener nuevos ojos.",
      pt: "A verdadeira viagem de descoberta não consiste em buscar novas paisagens, mas em ter novos olhos.",
      tr: "Gerçek keşif yolculuğu yeni manzaralar aramaktan değil, yeni gözlere sahip olmaktan geçer.",
      sv: "Den verkliga upptäcktsresan består inte i att söka nya landskap, utan i att ha nya ögon.",
      da: "Den sande opdagelsesrejse består ikke i at søge nye landskaber, men i at have nye øjne.",
      ru: "Настоящее путешествие открытия состоит не в поиске новых пейзажей, а в обретении нового взгляда.",
      ro: "Adevărata călătorie a descoperirii nu constă în căutarea unor peisaje noi, ci în a avea ochi noi.",
      hu: "Az igazi felfedező utazás nem új tájak kereséséből áll, hanem abból, hogy új szemünk legyen.",
      ja: "真の発見の旅とは、新しい風景を探すことではなく、新しい目を持つことにある。",
      zh: "真正的发现之旅不在于寻找新的风景，而在于拥有新的眼光。",
      ko: "진정한 발견의 여정은 새로운 풍경을 찾는 데 있지 않고, 새로운 눈을 갖는 데 있다.",
    },
  },

  // 35 — German / Goethe
  {
    id: "goethe-sprache-seele",
    original: {
      lang: "de",
      langDisplayName: "German",
      flag: "🇩🇪",
      text: "Mit dem Wissen wächst der Zweifel.",
    },
    attribution: "Johann Wolfgang von Goethe",
    translations: {
      en: "With knowledge grows doubt.",
      fr: "Avec la connaissance croît le doute.",
      de: "Mit dem Wissen wächst der Zweifel.",
      it: "Con la conoscenza cresce il dubbio.",
      es: "Con el conocimiento crece la duda.",
      pt: "Com o conhecimento cresce a dúvida.",
      tr: "Bilgiyle şüphe büyür.",
      sv: "Med kunskap växer tvivlet.",
      da: "Med viden vokser tvivlen.",
      ru: "С знанием растёт сомнение.",
      ro: "Odată cu cunoașterea crește îndoiala.",
      hu: "A tudással együtt nő a kétség.",
      ja: "知識が増すにつれて、疑いも増す。",
      zh: "知识越多，疑虑越增。",
      ko: "지식이 자라남에 따라 의심도 자란다.",
    },
  },

  // 36 — Latin / Horace
  {
    id: "horace-carpe-diem",
    original: {
      lang: "la",
      langDisplayName: "Latin",
      flag: "",
      text: "Carpe diem, quam minimum credula postero.",
    },
    attribution: "Horace, Odes I.11",
    translations: {
      en: "Seize the day, trusting as little as possible in tomorrow.",
      fr: "Cueille le jour, en te fiant le moins possible au lendemain.",
      de: "Ergreife den Tag und vertraue dem Morgen so wenig wie möglich.",
      it: "Cogli l'attimo, fidandoti il meno possibile del domani.",
      es: "Aprovecha el día, confiando lo menos posible en el mañana.",
      pt: "Aproveita o dia, confiando o mínimo possível no amanhã.",
      tr: "Günü yakala, yarına olabildiğince az güvenerek.",
      sv: "Grip dagen och lita så lite som möjligt på morgondagen.",
      da: "Grib dagen, og stol så lidt som muligt på morgendagen.",
      ru: "Лови мгновение, как можно меньше полагаясь на завтра.",
      ro: "Profită de ziua de azi, încredințându-te cât mai puțin zilei de mâine.",
      hu: "Ragadd meg a napot, és bízz a holnapban a lehető legkevésbé.",
      ja: "今日という日をつかめ。明日をできるだけ当てにするな。",
      zh: "把握今日，尽量不要寄望于明天。",
      ko: "오늘을 붙잡으라, 내일은 가능한 한 믿지 말고.",
    },
  },

  // 37 — Persian / Hafez
  {
    id: "hafez-heart-sea",
    original: {
      lang: "fa",
      langDisplayName: "Persian",
      flag: "🇮🇷",
      text: "دل دریایی‌ست کران‌ناپیدا.",
    },
    attribution: "Hafez of Shiraz",
    translations: {
      en: "The heart is a sea with no visible shore.",
      fr: "Le cœur est une mer sans rive visible.",
      de: "Das Herz ist ein Meer ohne sichtbares Ufer.",
      it: "Il cuore è un mare senza riva visibile.",
      es: "El corazón es un mar sin orilla visible.",
      pt: "O coração é um mar sem margem visível.",
      tr: "Kalp, görünür kıyısı olmayan bir denizdir.",
      sv: "Hjärtat är ett hav utan synlig strand.",
      da: "Hjertet er et hav uden synlig kyst.",
      ru: "Сердце — это море без видимого берега.",
      ro: "Inima este o mare fără țărm vizibil.",
      hu: "A szív egy tenger látható part nélkül.",
      ja: "心は岸の見えない海である。",
      zh: "心是一片望不见岸的海。",
      ko: "마음은 보이는 기슭이 없는 바다이다.",
    },
  },

  // 38 — Zulu / proverb (Ubuntu)
  {
    id: "proverb-ubuntu-person",
    original: {
      lang: "zu",
      langDisplayName: "Zulu",
      flag: "",
      text: "Umuntu ngumuntu ngabantu.",
    },
    attribution: "Ubuntu proverb (Zulu / Nguni)",
    translations: {
      en: "A person is a person through other persons.",
      fr: "Une personne est une personne à travers les autres personnes.",
      de: "Ein Mensch ist ein Mensch durch andere Menschen.",
      it: "Una persona è una persona attraverso le altre persone.",
      es: "Una persona es una persona a través de otras personas.",
      pt: "Uma pessoa é uma pessoa por meio de outras pessoas.",
      tr: "Bir insan, diğer insanlar sayesinde insandır.",
      sv: "En person är en person genom andra personer.",
      da: "Et menneske er et menneske gennem andre mennesker.",
      ru: "Человек становится человеком через других людей.",
      ro: "O persoană este o persoană prin intermediul celorlalte persoane.",
      hu: "Az ember más emberek által válik emberré.",
      ja: "人は他者を通して人となる。",
      zh: "人因他人而成其为人。",
      ko: "사람은 다른 사람들을 통해 사람이 된다.",
    },
  },

  // 39 — Italian / Galileo
  {
    id: "galileo-universe-mathematics",
    original: {
      lang: "it",
      langDisplayName: "Italian",
      flag: "🇮🇹",
      text: "La matematica è l'alfabeto con cui Dio ha scritto l'universo.",
    },
    attribution: "Galileo Galilei",
    translations: {
      en: "Mathematics is the alphabet with which God has written the universe.",
      fr: "Les mathématiques sont l'alphabet avec lequel Dieu a écrit l'univers.",
      de: "Die Mathematik ist das Alphabet, mit dem Gott das Universum geschrieben hat.",
      it: "La matematica è l'alfabeto con cui Dio ha scritto l'universo.",
      es: "Las matemáticas son el alfabeto con el que Dios ha escrito el universo.",
      pt: "A matemática é o alfabeto com o qual Deus escreveu o universo.",
      tr: "Matematik, Tanrı'nın evreni yazdığı alfabedir.",
      sv: "Matematiken är det alfabet med vilket Gud har skrivit universum.",
      da: "Matematik er det alfabet, som Gud har skrevet universet med.",
      ru: "Математика — алфавит, которым Бог написал вселенную.",
      ro: "Matematica este alfabetul cu care Dumnezeu a scris universul.",
      hu: "A matematika az az ábécé, amellyel Isten megírta a világegyetemet.",
      ja: "数学は、神が宇宙を書き記したアルファベットである。",
      zh: "数学是上帝书写宇宙所用的字母。",
      ko: "수학은 신이 우주를 써 내려간 알파벳이다.",
    },
  },

  // 40 — Russian / Tolstoy
  {
    id: "tolstoy-happy-families",
    original: {
      lang: "ru",
      langDisplayName: "Russian",
      flag: "🇷🇺",
      text: "Все счастливые семьи похожи друг на друга, каждая несчастливая семья несчастлива по-своему.",
    },
    attribution: "Leo Tolstoy, Anna Karenina",
    translations: {
      en: "All happy families are alike; each unhappy family is unhappy in its own way.",
      fr: "Toutes les familles heureuses se ressemblent ; chaque famille malheureuse est malheureuse à sa façon.",
      de: "Alle glücklichen Familien gleichen einander; jede unglückliche Familie ist auf ihre eigene Weise unglücklich.",
      it: "Tutte le famiglie felici si assomigliano; ogni famiglia infelice è infelice a modo suo.",
      es: "Todas las familias felices se parecen; cada familia infeliz es infeliz a su manera.",
      pt: "Todas as famílias felizes se assemelham; cada família infeliz é infeliz à sua maneira.",
      tr: "Bütün mutlu aileler birbirine benzer; her mutsuz aile kendi yolunda mutsuzdur.",
      sv: "Alla lyckliga familjer liknar varandra; varje olycklig familj är olycklig på sitt eget sätt.",
      da: "Alle lykkelige familier ligner hinanden; enhver ulykkelig familie er ulykkelig på sin egen måde.",
      ru: "Все счастливые семьи похожи друг на друга, каждая несчастливая семья несчастлива по-своему.",
      ro: "Toate familiile fericite seamănă între ele; fiecare familie nefericită este nefericită în felul ei.",
      hu: "Minden boldog család egyforma; minden boldogtalan család a maga módján boldogtalan.",
      ja: "幸福な家庭はどれも似たものだが、不幸な家庭はそれぞれに不幸である。",
      zh: "幸福的家庭都是相似的，不幸的家庭各有各的不幸。",
      ko: "행복한 가정은 모두 비슷하지만, 불행한 가정은 저마다의 이유로 불행하다.",
    },
  },

  // 41 — Swahili / proverb
  {
    id: "proverb-swahili-unity",
    original: {
      lang: "sw",
      langDisplayName: "Swahili",
      flag: "",
      text: "Umoja ni nguvu, utengano ni udhaifu.",
    },
    attribution: "Swahili proverb",
    translations: {
      en: "Unity is strength, division is weakness.",
      fr: "L'unité est la force, la division est la faiblesse.",
      de: "Einheit ist Stärke, Spaltung ist Schwäche.",
      it: "L'unità è forza, la divisione è debolezza.",
      es: "La unidad es fuerza, la división es debilidad.",
      pt: "A unidade é força, a divisão é fraqueza.",
      tr: "Birlik güçtür, ayrılık zayıflıktır.",
      sv: "Enighet är styrka, splittring är svaghet.",
      da: "Enhed er styrke, splittelse er svaghed.",
      ru: "Единство — сила, разобщённость — слабость.",
      ro: "Unitatea este putere, dezbinarea este slăbiciune.",
      hu: "Az egység erő, a megosztottság gyengeség.",
      ja: "団結は力であり、分裂は弱さである。",
      zh: "团结就是力量，分裂就是软弱。",
      ko: "단결은 힘이요, 분열은 약함이다.",
    },
  },

  // 42 — Spanish / García Márquez
  {
    id: "garcia-marquez-solitude",
    original: {
      lang: "es",
      langDisplayName: "Spanish",
      flag: "🇪🇸",
      text: "La vida no es la que uno vivió, sino la que uno recuerda y cómo la recuerda para contarla.",
    },
    attribution: "Gabriel García Márquez",
    translations: {
      en: "Life is not what one lived, but what one remembers and how one remembers it to tell it.",
      fr: "La vie n'est pas ce que l'on a vécu, mais ce que l'on se rappelle et comment on s'en souvient pour la raconter.",
      de: "Das Leben ist nicht das, was man gelebt hat, sondern das, was man erinnert, und wie man es erinnert, um es zu erzählen.",
      it: "La vita non è quella che si è vissuta, ma quella che si ricorda e come la si ricorda per raccontarla.",
      es: "La vida no es la que uno vivió, sino la que uno recuerda y cómo la recuerda para contarla.",
      pt: "A vida não é a que se viveu, mas a que se recorda e como se recorda para contá-la.",
      tr: "Hayat, yaşadığınız değil, hatırladığınız ve onu anlatmak için nasıl hatırladığınızdır.",
      sv: "Livet är inte det man levde, utan det man minns och hur man minns det för att berätta det.",
      da: "Livet er ikke det, man har levet, men det, man husker, og hvordan man husker det for at fortælle det.",
      ru: "Жизнь — это не то, что ты прожил, а то, что ты помнишь, и то, как ты это помнишь, чтобы рассказать.",
      ro: "Viața nu este cea trăită, ci cea amintită și cum este amintită pentru a fi povestită.",
      hu: "Az élet nem az, amit megéltünk, hanem amit emlékezetünkbe vésünk és ahogyan elmondjuk.",
      ja: "人生とは、人が生きたものではなく、人が覚えているもの、そしてそれを語るためにどう覚えているかである。",
      zh: "生活不是一个人所经历的，而是他所记得的，以及他如何记得它去讲述。",
      ko: "인생은 우리가 산 것이 아니라, 우리가 기억하는 것, 그리고 그것을 이야기하기 위해 어떻게 기억하느냐이다.",
    },
  },

  // 43 — Ancient Greek / Aristotle
  {
    id: "aristotle-excellence-habit",
    original: {
      lang: "grc",
      langDisplayName: "Ancient Greek",
      flag: "",
      text: "Ἐσμὲν δ' ὅ τι ποιοῦμεν.",
    },
    attribution: "Aristotle (paraphrased)",
    translations: {
      en: "We are what we repeatedly do.",
      fr: "Nous sommes ce que nous faisons répétitivement.",
      de: "Wir sind, was wir wiederholt tun.",
      it: "Siamo ciò che facciamo ripetutamente.",
      es: "Somos lo que hacemos repetidamente.",
      pt: "Somos o que fazemos repetidamente.",
      tr: "Biz tekrar tekrar yaptıklarımızız.",
      sv: "Vi är vad vi gör upprepade gånger.",
      da: "Vi er, hvad vi gentagne gange gør.",
      ru: "Мы — то, что мы повторяем снова и снова.",
      ro: "Suntem ceea ce facem în mod repetat.",
      hu: "Azok vagyunk, amit ismételten cselekszünk.",
      ja: "我々は繰り返し行うことそのものである。",
      zh: "我们由我们反复做的事所造就。",
      ko: "우리는 우리가 반복해서 행하는 것 그 자체이다.",
    },
  },

  // 44 — Finnish / proverb
  {
    id: "proverb-finnish-stranger",
    original: {
      lang: "fi",
      langDisplayName: "Finnish",
      flag: "🇫🇮",
      text: "Vieraassa maassa elää, kaksi kieltä oppii.",
    },
    attribution: "Finnish proverb",
    translations: {
      en: "To live in a foreign land is to learn two languages.",
      fr: "Vivre dans un pays étranger, c'est apprendre deux langues.",
      de: "In einem fremden Land zu leben bedeutet, zwei Sprachen zu lernen.",
      it: "Vivere in una terra straniera significa imparare due lingue.",
      es: "Vivir en tierra extranjera es aprender dos idiomas.",
      pt: "Viver numa terra estrangeira é aprender duas línguas.",
      tr: "Yabancı bir ülkede yaşamak iki dil öğrenmektir.",
      sv: "Att leva i ett främmande land är att lära sig två språk.",
      da: "At leve i et fremmed land er at lære to sprog.",
      ru: "Жить в чужой стране — значит учить два языка.",
      ro: "A trăi într-o țară străină înseamnă a învăța două limbi.",
      hu: "Idegen földön élni két nyelv tanulását jelenti.",
      ja: "異国の地で暮らすことは、二つの言語を学ぶことである。",
      zh: "生活在异乡，就是学习两种语言。",
      ko: "낯선 땅에서 사는 것은 두 개의 언어를 배우는 것이다.",
    },
  },

  // 45 — Welsh / proverb
  {
    id: "proverb-welsh-language",
    original: {
      lang: "cy",
      langDisplayName: "Welsh",
      flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
      text: "Cenedl heb iaith, cenedl heb galon.",
    },
    attribution: "Welsh proverb",
    translations: {
      en: "A nation without a language is a nation without a heart.",
      fr: "Une nation sans langue est une nation sans cœur.",
      de: "Eine Nation ohne Sprache ist eine Nation ohne Herz.",
      it: "Una nazione senza lingua è una nazione senza cuore.",
      es: "Una nación sin lengua es una nación sin corazón.",
      pt: "Uma nação sem língua é uma nação sem coração.",
      tr: "Dili olmayan millet, kalbi olmayan millettir.",
      sv: "En nation utan språk är en nation utan hjärta.",
      da: "En nation uden et sprog er en nation uden et hjerte.",
      ru: "Народ без языка — народ без сердца.",
      ro: "O națiune fără limbă este o națiune fără inimă.",
      hu: "A nyelv nélküli nép szív nélküli nép.",
      ja: "言語を持たない民族は、心を持たない民族である。",
      zh: "没有语言的民族，是没有心的民族。",
      ko: "언어가 없는 민족은 마음이 없는 민족이다.",
    },
  },

  // 46 — Hebrew / proverb
  {
    id: "proverb-hebrew-word-deed",
    original: {
      lang: "he",
      langDisplayName: "Hebrew",
      flag: "🇮🇱",
      text: "אמור מעט ועשה הרבה.",
    },
    attribution: "Talmud, Avot 1:15",
    translations: {
      en: "Say little and do much.",
      fr: "Dis peu et fais beaucoup.",
      de: "Rede wenig und tu viel.",
      it: "Di' poco e fa' molto.",
      es: "Di poco y haz mucho.",
      pt: "Diga pouco e faça muito.",
      tr: "Az söyle, çok yap.",
      sv: "Säg lite och gör mycket.",
      da: "Sig lidt og gør meget.",
      ru: "Говори мало — делай много.",
      ro: "Spune puțin și fă mult.",
      hu: "Keveset mondj és sokat tégy.",
      ja: "言葉は少なく、行いは多く。",
      zh: "少说多做。",
      ko: "말은 적게 하고 행동은 많이 하라.",
    },
  },

  // 47 — Turkish / Yunus Emre
  {
    id: "yunus-emre-words",
    original: {
      lang: "tr",
      langDisplayName: "Turkish",
      flag: "🇹🇷",
      text: "Söz ola kese savaşı, söz ola kestire başı.",
    },
    attribution: "Yunus Emre",
    translations: {
      en: "A word can end a war; a word can also take a head.",
      fr: "Un mot peut arrêter une guerre ; un mot peut aussi coûter une tête.",
      de: "Ein Wort kann einen Krieg beenden; ein Wort kann auch einen Kopf kosten.",
      it: "Una parola può porre fine a una guerra; una parola può anche costare una testa.",
      es: "Una palabra puede terminar una guerra; una palabra también puede costar una cabeza.",
      pt: "Uma palavra pode acabar com uma guerra; uma palavra também pode custar uma cabeça.",
      tr: "Söz ola kese savaşı, söz ola kestire başı.",
      sv: "Ett ord kan avsluta ett krig; ett ord kan också kosta ett huvud.",
      da: "Et ord kan afslutte en krig; et ord kan også koste et hoved.",
      ru: "Слово может остановить войну; слово может и голову снять.",
      ro: "Un cuvânt poate opri un război; un cuvânt poate și lua un cap.",
      hu: "Egy szó megállíthat egy háborút; egy szó fejet is vehet.",
      ja: "一言が戦を終わらせ、一言が首をも落とす。",
      zh: "一句话能止息战争，一句话也能取人首级。",
      ko: "말 한마디가 전쟁을 끝낼 수도 있고, 말 한마디가 목을 벨 수도 있다.",
    },
  },

  // 48 — Latin / Virgil
  {
    id: "virgil-audentes-fortuna",
    original: {
      lang: "la",
      langDisplayName: "Latin",
      flag: "",
      text: "Audentes fortuna iuvat.",
    },
    attribution: "Virgil, Aeneid X.284",
    translations: {
      en: "Fortune favors the bold.",
      fr: "La fortune sourit aux audacieux.",
      de: "Das Glück begünstigt die Mutigen.",
      it: "La fortuna aiuta gli audaci.",
      es: "La fortuna favorece a los audaces.",
      pt: "A fortuna favorece os audazes.",
      tr: "Şans cesurların yanındadır.",
      sv: "Lyckan gynnar de djärva.",
      da: "Lykken begunstigerer de dristige.",
      ru: "Фортуна благоволит смелым.",
      ro: "Norocul îi ajută pe îndrăzneți.",
      hu: "A szerencse a bátraknak kedvez.",
      ja: "幸運は勇者に味方する。",
      zh: "命运眷顾勇者。",
      ko: "운명은 용감한 자의 편이다.",
    },
  },

  // 49 — Igbo / proverb
  {
    id: "proverb-igbo-palm",
    original: {
      lang: "ig",
      langDisplayName: "Igbo",
      flag: "",
      text: "Onye wetara oji wetara ndụ.",
    },
    attribution: "Igbo proverb",
    translations: {
      en: "He who brings kola brings life.",
      fr: "Celui qui apporte la cola apporte la vie.",
      de: "Wer Kola bringt, bringt das Leben.",
      it: "Chi porta la cola porta la vita.",
      es: "Quien trae la nuez de cola trae la vida.",
      pt: "Quem traz a noz de cola traz a vida.",
      tr: "Kola fındığı getiren hayat getirir.",
      sv: "Den som tar med kola tar med sig livet.",
      da: "Den, der bringer kola, bringer livet.",
      ru: "Тот, кто приносит колу, приносит жизнь.",
      ro: "Cel care aduce nuca de cola aduce viața.",
      hu: "Aki kolát hoz, életet hoz.",
      ja: "コーラの実をもたらす者は、命をもたらす。",
      zh: "带来可乐果的人，带来生命。",
      ko: "콜라 열매를 가져오는 이는 생명을 가져온다.",
    },
  },

  // 50 — Sanskrit / Bhagavad Gita
  {
    id: "bhagavad-gita-action",
    original: {
      lang: "sa",
      langDisplayName: "Sanskrit",
      flag: "",
      text: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।",
    },
    attribution: "Bhagavad Gita 2.47",
    translations: {
      en: "You have a right to perform your actions, but never to the fruits of those actions.",
      fr: "Tu as le droit d'agir, mais jamais de revendiquer les fruits de tes actions.",
      de: "Du hast das Recht zu handeln, aber niemals auf die Früchte deiner Handlungen.",
      it: "Hai il diritto di compiere le tue azioni, ma mai di rivendicare i frutti di esse.",
      es: "Tienes derecho a realizar tus acciones, pero nunca a los frutos de esas acciones.",
      pt: "Tens o direito de realizar as tuas ações, mas nunca aos seus frutos.",
      tr: "Eylemlerini gerçekleştirme hakkına sahipsin, ancak asla onların meyvelerine değil.",
      sv: "Du har rätt att utföra dina handlingar, men aldrig till frukterna av dessa handlingar.",
      da: "Du har ret til at udføre dine handlinger, men aldrig til frugterne af disse handlinger.",
      ru: "Ты имеешь право действовать, но никогда — на плоды своих действий.",
      ro: "Ai dreptul să-ți îndeplinești acțiunile, dar niciodată la roadele lor.",
      hu: "Jogod van cselekedni, de soha a tetteid gyümölcseire.",
      ja: "あなたには行為をなす権利はあるが、その果実に対する権利は決してない。",
      zh: "你有权履行你的行动，但永远无权索取其果实。",
      ko: "그대에게는 행위를 할 권리가 있을 뿐, 그 결실에 대한 권리는 결코 없다.",
    },
  },
];

/**
 * Compute 1-based day-of-year in the given IANA timezone.
 * Uses Intl to convert "now" to the local date, then counts days from Jan 1.
 */
export function dayOfYearInTimezone(date: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));

  const startOfYearMs = Date.UTC(year, 0, 1);
  const localMs = Date.UTC(year, month - 1, day);
  return Math.floor((localMs - startOfYearMs) / (1000 * 60 * 60 * 24)) + 1;
}

/** Returns the quote for `date` in `timezone`. Deterministic. */
export function quoteForDay(date: Date, timezone: string): DailyQuote {
  if (DAILY_QUOTES.length === 0) {
    throw new Error("DAILY_QUOTES is empty — populate the catalog");
  }
  const dayIndex =
    (dayOfYearInTimezone(date, timezone) - 1) % DAILY_QUOTES.length;
  // dayIndex is always in [0, length-1] by construction; non-null assertion is safe.
  return DAILY_QUOTES[dayIndex]!;
}
