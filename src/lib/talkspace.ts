// Central constants imported from talkspace.ng
export const TS = {
  brandName: "Talk Space Counselling Services",
  tagline: "Confidential. Professional. Accessible.",
  results: "Client-centred, evidence-based care",

  phone: {
    ng: "+234 809 993 1039",
    ngHref: "tel:+2348099931039",
    whatsapp: "+234 704 846 9090",
    whatsappNumber: "2347048469090",
  },

  email: "hello@talkspace.ng",

  hours: "Mon to Fri · 9:00 am to 5:00 pm WAT",

  addresses: [
    {
      city: "Abuja (FCT)",
      lines: ["Plot 153A, T-Pumpy Estate", "Opp. NIU Estate, Off Saburi 1, FCT, Abuja"],
    },
    {
      city: "Lagos",
      lines: ["20, Estaport Avenue", "Gbagada, Lagos, Nigeria"],
    },
  ],

  socials: {
    facebook: "https://facebook.com/talkspaceng",
    twitter: "https://twitter.com/talkspace_ng",
    instagram: "https://instagram.com/talkspace_ng",
    linkedin: "https://www.linkedin.com/company/talkspaceng",
    youtube: "https://www.youtube.com/@talkspaceng",
  },

  paystack: {
    individual: "https://paystack.com/buy/vit",
    couple: "https://paystack.com/buy/vcc",
    oneMonthIndividual: "https://paystack.com/buy/omp",
    oneMonthCouple: "https://paystack.com/buy/vchpaz",
  },

  specialties: [
    "Anxiety & Stress Disorders",
    "Marriage & Couple Therapy",
    "Trauma & PTSD",
    "Teen & Child Therapy",
    "Individual Psychotherapy",
    "Family & Premarital Counseling",
  ],
} as const;

export const WHATSAPP_MESSAGE = "Hi Talk Space, I'd like to ask about booking a session.";

export const WHATSAPP_HREF = `https://wa.me/${TS.phone.whatsappNumber}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE,
)}`;

// Public Google review excerpts from the Talk Space Counselling Maps profile.
export const REVIEWS = [
  {
    name: "ibrahim oliyide",
    date: "6 months ago",
    quote:
      "My experience with Tunbi Olabisi's online counseling service was very positive. The individual therapy sessions helped me manage stress and emotional challenges.",
  },
  {
    name: "Inioluwa Opemipo",
    date: "6 months ago",
    quote:
      "From couple therapy to individual sessions, every interaction felt supportive and professional. Tunbi Olabisi truly cares about her clients.",
  },
  {
    name: "Faizah Bukoye",
    date: "10 months ago",
    quote:
      "Honest review here - if you have been looking for a counselor, look no further. My experience with Talkspace was an amazing one from the first call to my last session.",
  },
  {
    name: "Oluwafemi Adeyinka",
    date: "11 months ago",
    quote:
      "At first I was not sure online counselling would help, but Talkspace proved me wrong. The sessions felt safe, real, and gave me practical steps to manage my emotions better.",
  },
  {
    name: "AkIn Oyekan Love",
    date: "7 months ago",
    quote:
      "Tunbi Olabisi provides a very professional counseling service. I benefited greatly from individual therapy and online counseling sessions.",
  },
  {
    name: "Aromokun Tolulope",
    date: "11 months ago",
    quote:
      "Talk Space Counselling Services gave me that safe space. The sessions helped me deal with stress, marriage issues, and identity conflicts.",
  },
  {
    name: "Loading joe",
    date: "7 months ago",
    quote:
      "Tunbi Olabisi provides excellent counselling services. She is patient, professional and truly passionate about emotional healing and mental wellness.",
  },
  {
    name: "Nkem Jessica",
    date: "11 months ago",
    quote:
      "Therapy with Talk Space Counseling Services was life changing. From stress at work to personal trauma, my therapist helped me heal step by step.",
  },
] as const;
