export type RolePlayScenario = {
  id: string;
  title: { en: string; fr: string };
  description: { en: string; fr: string };
  systemPromptFragment: string;
  pro: boolean;
};

export const ROLE_PLAY_SCENARIOS: RolePlayScenario[] = [
  {
    id: "coffee",
    title: {
      en: "Ordering coffee or food",
      fr: "Commander un café ou à manger",
    },
    description: {
      en: "At a small local café. Casual register.",
      fr: "Dans un petit café local. Registre familier.",
    },
    pro: false,
    systemPromptFragment:
      "Play the role of the barista at a small local café. Greet the student naturally. Take their order. Mid-conversation, introduce a twist: either the espresso machine is broken, the pastry they want is out, OR the card reader is down (pick one). Keep it natural and brief.",
  },
  {
    id: "directions",
    title: { en: "Asking for directions", fr: "Demander son chemin" },
    description: {
      en: "A stranger on the street. The student needs to find a landmark.",
      fr: "Un inconnu dans la rue. L'étudiant cherche un lieu connu.",
    },
    pro: false,
    systemPromptFragment:
      "Play the role of a friendly stranger the student stops on the street. They are trying to find a well-known landmark in your city. Give directions with a couple of landmarks (e.g., 'turn left at the bakery'). Be patient if they ask you to repeat. Optional twist: you don't actually know — suggest someone else.",
  },
  {
    id: "party",
    title: { en: "Small talk at a party", fr: "Conversation à une fête" },
    description: {
      en: "First meeting at a friend-of-a-friend's party.",
      fr: "Première rencontre à la fête d'un ami d'ami.",
    },
    pro: false,
    systemPromptFragment:
      "Play the role of another guest at a friend-of-a-friend's birthday party. Introduce yourself, ask how they know the host. Mid-conversation, find one thing in common (job, hobby, travel) and dig into it. Keep it light, casual register.",
  },
  {
    id: "hotel",
    title: { en: "Hotel check-in", fr: "Arrivée à l'hôtel" },
    description: {
      en: "Polite formal register. Reservation issue mid-way.",
      fr: "Registre poli. Problème de réservation à mi-parcours.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a hotel receptionist. Greet the student formally, ask for their booking name, and present a small issue: their room isn't ready yet OR they were upgraded but it costs extra OR there's a noise complaint about a neighbor. Negotiate politely.",
  },
  {
    id: "doctor",
    title: { en: "Doctor visit", fr: "Chez le médecin" },
    description: {
      en: "Describing symptoms; understanding instructions for medication.",
      fr: "Décrire ses symptômes; comprendre les instructions pour un médicament.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a kind GP. Ask the student what brings them in. Ask follow-up questions about symptoms (when it started, severity, prior episodes). Eventually give them a prescription and clear instructions (dosage, frequency, duration). Be patient with vocabulary.",
  },
  {
    id: "interview",
    title: { en: "Job interview", fr: "Entretien d'embauche" },
    description: {
      en: "Formal register; test how the student responds to a hard question.",
      fr: "Registre formel; tester comment l'étudiant répond à une question difficile.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a hiring manager interviewing the student for a role in their field. After 2-3 friendly opening questions, ask ONE harder question (e.g., 'tell me about a failure', or 'why are you leaving your current job?') and follow up. Keep your turns short — let them talk.",
  },
  {
    id: "complaint",
    title: {
      en: "Customer-service complaint",
      fr: "Réclamation au service client",
    },
    description: {
      en: "Assertive register without being rude.",
      fr: "Registre assertif sans être impoli.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a customer-service agent on the phone. The student has a complaint (defective product, late delivery, billing error — let them pick). Initially be slightly bureaucratic; if they advocate clearly, eventually offer a fair resolution. Keep it realistic, not theatrical.",
  },
  {
    id: "phone-friend",
    title: {
      en: "Phone call with a friend",
      fr: "Appel téléphonique avec un ami",
    },
    description: {
      en: "Casual, fast, contractions allowed.",
      fr: "Décontracté, rapide, contractions permises.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a close friend the student hasn't spoken to in a few weeks. Catch up — what's new, what's coming up. Casual register, slang OK. Mention one small thing going on in your life that needs their advice.",
  },
  {
    id: "meeting",
    title: {
      en: "Workplace meeting intro",
      fr: "Présentation en réunion au travail",
    },
    description: {
      en: "Polite professional; the student introduces themselves to a new team.",
      fr: "Professionnel poli; l'étudiant se présente à une nouvelle équipe.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a colleague chairing a meeting where the student is the new joiner. Invite them to introduce themselves, ask 1-2 friendly questions about their background, then ask them what they're looking forward to. Keep it brief and warm.",
  },
  {
    id: "emergency",
    title: {
      en: "Lost passport — police station",
      fr: "Passeport perdu — au commissariat",
    },
    description: {
      en: "Stressed formal register; following instructions under pressure.",
      fr: "Registre formel et stressé; suivre des instructions sous pression.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a police officer at a station. The student has lost their passport while traveling. Ask the necessary questions (when, where, identifying details, hotel address), give them clear next steps (which embassy to contact, what documents to bring, fee). Keep tone professional.",
  },
];
