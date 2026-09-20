import heroImg from "@/assets/unsplash-african-women-conversation.jpg";
import beyondSilenceImg from "@/assets/unsplash-nigerian-man-portrait.jpg";
import marriageImg from "@/assets/unsplash-african-couch-conversation.jpg";
import coupleTherapyImg from "@/assets/couples-therapy.jpg";
import familyTherapyImg from "@/assets/family-therapy.jpg";
import individualTherapyImg from "@/assets/individual-therapy.jpg";
import beyondSilenceAvif from "@/assets/ts-beyond-silence.avif";

export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  author: string;
  image: string;
  imageAvif?: string;
  imageAlt: string;
  category: string;
  seoTitle: string;
  seoDescription: string;
  excerpt: string;
  body: string[];
};

// Content adapted from Talk Space source posts, summarised/paraphrased for the Journal.
export const POSTS: BlogPost[] = [
  {
    slug: "choose-wisely-we-only-get-time-and-choice",
    title: "Choose Wisely, We Only Get Time and Choice",
    date: "December 24, 2025",
    author: "Talk Space",
    image: heroImg,
    imageAlt: "Black African woman smiling in a calm counselling office",
    category: "Self awareness",
    seoTitle: "Choose Wisely: Time, Choice and Mental Health | Talk Space Journal",
    seoDescription:
      "A Nigerian therapist's New Year reflection on time, choice, emotional awareness and choosing counselling before old patterns repeat.",
    excerpt:
      "A New Year reflection on the two forces that shape every life: time, which never waits, and choice, which quietly builds our future.",
    body: [
      "As one year closes and another begins, one truth becomes clearer than ever: life is driven by two forces, time and choice. Not money, luck or willpower. Just time, which keeps moving, and choice, which decides what that time produces.",
      "Time is impartial. A CEO and a student, a newlywed couple and a couple in crisis, all receive the same twenty-four hours. Time is the ultimate equaliser, but the choices we make with it are what separate us.",
      "Every year, many of us pray for change, hope for change, or wait for it. But life doesn't respond to hope; it responds to choices. Your relationships, your peace of mind, your mental health, your career and your habits are all shaped by the decisions you make each day.",
      "The most sobering truth is that you cannot outsource your choices. Even avoiding a decision is a choice. Some people prefer silence. Some keep repeating cycles because change feels frightening. Some keep choosing 'later' because it feels safer than now, but delay isn't a strategy, it's a slow leak.",
      "As this year closes, sit with a few questions, not to feel guilty, but to see clearly. What took up most of your time? What choices moved you closer to the life you want? What did you tolerate that you should have confronted? What future did your choices quietly build?",
      "The move from December 31st to January 1st doesn't automatically heal what you refuse to face. A new year is a new container. It will hold whatever choices you place in it.",
      "If you want a better year, make better choices, starting with awareness. Awareness brings clarity, clarity gives courage, and courage makes transformation possible. You don't have to do this alone. Talk Space Counselling helps you understand your patterns, break the ones that repeat, and step into decisions rooted in wisdom rather than fear.",
      "As you step into a new year, choose healing over pretending. Choose communication over silence. Choose growth over comfort. Choose counselling over trying to handle it all alone. Time will pass. Your future will reflect what you choose today.",
    ],
  },
  {
    slug: "beyondsilence",
    title: "Beyond Silence: Men Must Speak to Heal",
    date: "June 15, 2025",
    author: "Talk Space",
    image: beyondSilenceImg,
    imageAvif: beyondSilenceAvif,
    imageAlt: "Nigerian man in thoughtful portrait against a warm background",
    category: "Men's mental health",
    seoTitle: "Beyond Silence: Why Nigerian Men Need Space to Heal",
    seoDescription:
      "Explore the cultural roots of male silence in Nigeria and how counselling helps men speak, heal and rebuild emotional connection.",
    excerpt:
      "The cultural roots of male silence in Nigeria and Africa, the toll it takes, and how therapy grounded in the African experience creates space to heal.",
    body: [
      "In the echo of a father's footsteps, the firmness of a brother's handshake, the still gaze of a son trying to be strong, there lives a silence too loud to ignore. Across Nigeria, Africa and the diaspora, men are raised to be providers, protectors and pillars, but rarely permitted to be human.",
      "Why is it hard for a man to say, 'I'm not okay'? Many were taught early that crying is weakness and sharing struggles is unmanly. So men bottle it up. They smile. They hustle. Inside, they battle depression, marital breakdowns and a quiet sense of being lost. Often they don't even recognise it as mental illness, only that they feel tired, disconnected or numb.",
      "From childhood, boys hear: be strong, don't be soft, you are the man of the house. This script produces adults who don't know how to ask for help. Men are expected to solve everyone's problems, and no one pauses to ask who helps the fixer.",
      "In marriage, many men struggle to express emotion. They were never taught to share pain, fear or doubt. Wives feel disconnected. Children grow up emotionally distant. The cycle continues.",
      "Globally, men are far more likely to die by suicide and far less likely to seek help. It isn't that they don't want it, they were taught not to need it. In many African homes, vulnerability is read as weakness. Emotional wounds are masked with work. Heartbreak is dulled with alcohol or humour. Depression is dismissed as laziness. Anxiety is answered with 'pray about it'.",
      "The cost of that silence is real: quiet battles with depression in high-rise offices, marital disconnection under the surface of a 'perfect husband', erectile difficulty rooted in emotional burnout, anxiety showing up as irritability, midlife crises with no vocabulary to explain what's wrong.",
      "At Talk Space Counselling we know this: speaking is not weakness, it is wisdom. We offer a safe, judgement-free space for men to take off the mask and put down the burdens they were told to carry alone. We help men manage depression, anxiety and trauma; navigate marital distance; heal from childhood wounds and the pressures of toxic masculinity; learn communication skills for marriage and fatherhood; and rediscover self-worth beyond social scripts.",
      "Real men don't suffer in silence. Real men speak, heal and evolve. Your healing starts with one conversation, let it be with us.",
    ],
  },
  {
    slug: "whymarriagedoesnotwork",
    title: "Why Marriage Does Not Work",
    date: "April 10, 2025",
    author: "Talk Space",
    image: marriageImg,
    imageAlt: "Black African couple seated together during a counselling conversation",
    category: "Marriage",
    seoTitle: "Why Marriage Does Not Work: Emotional Skills Modern Couples Need",
    seoDescription:
      "Marriage is changing, not dying. Learn why emotional safety, communication and counselling matter for modern Nigerian couples.",
    excerpt:
      "Marriage isn't dying, it's changing. Notes on the emotional skills modern marriages actually need.",
    body: [
      "There is a growing narrative, whispered in private circles and echoed online: marriage is outdated. But the truth is more precise, marriage isn't dead, it is changing. If we don't pay attention, we may miss how love, partnership and family life are transforming today.",
      "Research from The Gottman Institute, Pew and Harvard points to a few consistent trends. More women are opting out of marriage, not out of rebellion, but because they have more options, autonomy and access to growth. Men are becoming more emotionally reliant on their wives, especially in cultures where male friendships aren't emotionally expressive. Emotional intelligence, communication and mental health are now as important as financial stability when choosing a partner. Divorce is rising in many places, often not because love is lost, but because people are prioritising emotional safety over social expectation. This is true for Nigerians too.",
      "The script is changing across Lagos, Abuja, Accra and London. Younger women are saying, 'I don't want to suffer in the name of marriage.' Men are grappling with wives who now have careers, voices and choices. In religious houses, public forums and counselling rooms, the same tension shows up: we want love, but not at the cost of our peace.",
      "The shape of a healthy marriage today is different. It has moved from rigid roles to real partnership. It has moved from silent endurance to emotional safety. It has moved from family pressure to personal choice. Enjoyment, connection, chemistry, shared dreams and respect are no longer 'extras', they are the baseline.",
      "There is also a quiet truth society hasn't fully faced: recent studies suggest men often gain more emotional benefit from marriage than women, yet they were rarely taught the emotional skills that keep a modern marriage alive. Women now build support systems outside marriage and leave unhealthy relationships more quickly. This isn't an attack on men, it's a wake-up call.",
      "Marriage in the future will demand emotional intelligence as a non-negotiable. Therapy and counselling will not be a last resort but part of how couples care for each other. Children will model what they see: emotionally healthy homes teach them to believe in love; homes where pain is masked as endurance quietly teach them not to.",
      "So, is marriage still worth it? Yes, but only if it's built on truth, growth, compatibility and shared vision, not on pressure, pretence or outdated scripts. Marriage isn't dying. It is waiting for new definitions from people brave enough to love differently.",
    ],
  },
  {
    slug: "everybody-go-dey-alright",
    title: "Las Las, Everybody Go Dey Alright, But Are We?",
    date: "March 16, 2025",
    author: "Talk Space",
    image: familyTherapyImg,
    imageAlt: "Black African family sitting together during a warm therapy session",
    category: "Stress and resilience",
    seoTitle: "Las Las, Everybody Go Dey Alright: Coping, Stress and Therapy",
    seoDescription:
      "A Talk Space reflection on Nigerian resilience, emotional avoidance and when everyday coping becomes a sign to seek counselling.",
    excerpt:
      "A Nigerian reflection on resilience, emotional masking, and the quiet cost of pretending everything is fine.",
    body: [
      "'Las las, everybody go dey alright' is more than slang. For many Nigerians it has become a survival sentence, something we say when life is heavy and there is no obvious room to fall apart.",
      "There is wisdom in resilience. It helps people keep going through uncertainty, financial pressure, grief, family demands and public disappointment. But resilience can become dangerous when it turns into emotional silence.",
      "Sometimes the phrase is used to avoid naming pain. A person may be anxious, depressed, burnt out or lonely, but because they can still work, smile and joke, everyone assumes they are fine. The body often tells the truth first through insomnia, irritability, panic, headaches, withdrawal or sudden anger.",
      "Healing begins when we stop treating survival as the same thing as wellness. You may be functioning and still need support. You may be strong and still need a safe place to speak honestly. You may have faith and still benefit from therapy.",
      "Counselling gives language to what many people have only carried quietly. It helps you notice patterns, make sense of pressure, rebuild boundaries and choose healthier ways to respond to life.",
      "Everybody may go dey alright, but people do not heal by pretending. They heal through truth, support, rest, self-awareness and brave conversations.",
    ],
  },
  {
    slug: "never-struggle-in-your-marriage-again",
    title: "How to Stop Struggling in Your Marriage",
    date: "March 6, 2025",
    author: "Talk Space",
    image: coupleTherapyImg,
    imageAlt: "Black African couple smiling together in a therapy room",
    category: "Couples therapy",
    seoTitle: "How to Stop Struggling in Your Marriage | Couples Counselling Nigeria",
    seoDescription:
      "Learn how couples therapy can help Nigerian couples break conflict cycles, rebuild communication and create emotional safety.",
    excerpt:
      "Marriage does not have to feel like constant survival. Couples can learn new patterns before resentment becomes permanent.",
    body: [
      "Many couples do not wake up one day in a broken marriage. They arrive there slowly, through repeated misunderstandings, unresolved hurts, silence, criticism and small disappointments that were never repaired.",
      "The good news is that struggle does not have to be permanent. A difficult season can become a turning point when both partners are willing to understand the pattern, not only win the argument.",
      "Healthy marriage requires more than love. It requires emotional safety, clear communication, conflict repair, shared expectations, affection and the courage to say what is true without attacking each other.",
      "Couples counselling helps partners slow down the cycle. Instead of repeating the same fight in different words, therapy helps each person hear what sits underneath the reaction: fear, loneliness, unmet needs, betrayal, shame or exhaustion.",
      "For Nigerian couples, therapy can also create space to talk about family pressure, money, faith, gender expectations, parenting, sex, in-laws and the social pressure to look fine even when the home is hurting.",
      "You do not have to wait until divorce is the only word left in the room. The earlier couples seek help, the easier it is to rebuild trust, restore tenderness and create a marriage that feels safe for both people.",
    ],
  },
  {
    slug: "the-pressure-cooker-of-naija-life",
    title: "The Pressure Cooker of Naija Life",
    date: "February 26, 2025",
    author: "Talk Space",
    image: individualTherapyImg,
    imageAlt: "Black African woman speaking with a therapist in a bright counselling room",
    category: "Anxiety and depression",
    seoTitle: "The Pressure Cooker of Naija Life: Stress, Anxiety and Depression",
    seoDescription:
      "Why everyday Nigerian pressure can affect mental health, and how therapy helps with stress, anxiety, depression and burnout.",
    excerpt:
      "Why everyday Nigerian pressure can feel overwhelming, and how to recognise when stress has become a mental health concern.",
    body: [
      "Life in Nigeria can ask a lot from one person at once. Work pressure, rising costs, family responsibility, social comparison, traffic, uncertainty and the constant need to 'figure it out' can leave even capable people emotionally exhausted.",
      "This pressure is often normalised. People are praised for pushing through, staying busy and making things happen. But the nervous system still keeps score. Chronic stress can become anxiety, depression, burnout, irritability, sleep problems or a sense of being permanently overwhelmed.",
      "Many people do not call it depression. They say they are tired, disconnected, spiritually dry, unmotivated or no longer themselves. Others cope by withdrawing, overworking, snapping at loved ones or pretending everything is under control.",
      "Therapy does not remove every external pressure, but it can help you understand how pressure is affecting you. It gives structure for naming emotions, setting boundaries, reducing overwhelm and creating practical coping strategies.",
      "You deserve more than survival mode. Mental health support is not a luxury reserved for crisis. It is part of building a life where your body, mind, work and relationships are not always running on emergency power.",
      "If Naija life feels like a pressure cooker, counselling can help you breathe, think clearly and choose your next step with support.",
    ],
  },
];

const SLUG_ALIASES: Record<string, string> = {
  "beyond-silence": "beyondsilence",
  "why-marriage-does-not-work": "whymarriagedoesnotwork",
};

export function getPost(slug: string): BlogPost | undefined {
  const canonicalSlug = SLUG_ALIASES[slug] ?? slug;
  return POSTS.find((p) => p.slug === canonicalSlug);
}
