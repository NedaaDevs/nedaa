/** One gap in one dhikr: the words around it, its word and three others. */
export type DhikrTaskRowShape = {
  /** The dhikr's id in the Hisn al-Muslim database. */
  sourceId: number;
  before: string;
  after: string;
  answer: string;
  others: readonly [string, string, string];
};

/** While false, an alarm's dhikr task runs the typed board, not these rows. */
export const DHIKR_TASK_REVIEWED = false;

/** Rows from the Hisn al-Muslim text, vocalised by hand; under review. */
export const DHIKR_TASK_ROWS = [
  {
    sourceId: 38,
    before: "سَمِعَ اللَّهُ لِمَنْ ",
    after: "",
    answer: "حَمِدَهُ",
    others: ["شَكَرَهُ", "ذَكَرَهُ", "دَعَاهُ"],
  },
  {
    sourceId: 105,
    before: "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَ",
    after: "",
    answer: "أَحْيَا",
    others: ["أَنَامُ", "أَقُومُ", "أَسْتَيْقِظُ"],
  },
  {
    sourceId: 1,
    before: "الْحَمْدُ للَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا، وَإِلَيْهِ ",
    after: "",
    answer: "النُّشُورُ",
    others: ["الْمَآبُ", "الرُّجُوعُ", "الْمُنْتَهَى"],
  },
  {
    sourceId: 176,
    before: "ذَهَبَ الظَّمَأُ وَابْتَلَّتِ ",
    after: "، وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ",
    answer: "الْعُرُوقُ",
    others: ["الشِّفَاهُ", "الْقُلُوبُ", "الْأَرْضُ"],
  },
  {
    sourceId: 176,
    before: "ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ، وَثَبَتَ ",
    after: " إِنْ شَاءَ اللَّهُ",
    answer: "الْأَجْرُ",
    others: ["الثَّوَابُ", "الْخَيْرُ", "الصَّوْمُ"],
  },
  {
    sourceId: 172,
    before: "اللَّهُمَّ صَيِّباً ",
    after: "",
    answer: "نَافِعاً",
    others: ["طَيِّباً", "مُبَارَكاً", "غَزِيراً"],
  },
  {
    sourceId: 173,
    before: "",
    after: " بِفَضْلِ اللَّهِ وَرَحْمَتِهِ",
    answer: "مُطِرْنَا",
    others: ["سُقِينَا", "رُزِقْنَا", "أُغِثْنَا"],
  },
  {
    sourceId: 198,
    before: "جَزَاكَ اللَّهُ ",
    after: "",
    answer: "خَيْراً",
    others: ["أَجْراً", "ثَوَاباً", "بِرّاً"],
  },
  {
    sourceId: 147,
    before: "لاَ بَأْسَ ",
    after: " إِنْ شَاءَ اللَّهُ",
    answer: "طَهُورٌ",
    others: ["شِفَاءٌ", "عَافِيَةٌ", "أَجْرٌ"],
  },
  {
    sourceId: 59,
    before: "اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ، وَشُكْرِكَ، وَحُسْنِ ",
    after: "",
    answer: "عِبَادَتِكَ",
    others: ["طَاعَتِكَ", "دُعَائِكَ", "حَمْدِكَ"],
  },
  {
    sourceId: 61,
    before: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْجَنَّةَ وَأَعُوذُ بِكَ مِنَ ",
    after: "",
    answer: "النَّارِ",
    others: ["الْعَذَابِ", "الْفِتَنِ", "الشَّرِّ"],
  },
  {
    sourceId: 104,
    before: "اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ ",
    after: " عِبَادَكَ",
    answer: "تَبْعَثُ",
    others: ["تُحَاسِبُ", "تَحْشُرُ", "تَنْصُرُ"],
  },
  {
    sourceId: 193,
    before: "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ ",
    after: "",
    answer: "الرَّجِيمِ",
    others: ["اللَّعِينِ", "الْمَرِيدِ", "الْخَبِيثِ"],
  },
  {
    sourceId: 96,
    before: "أَسْتَغْفِرُ اللَّهَ وَ",
    after: " إِلَيْهِ",
    answer: "أَتُوبُ",
    others: ["أَرْجِعُ", "أُنِيبُ", "أَلْجَأُ"],
  },
  {
    sourceId: 124,
    before: "لاَ إِلَهَ إِلاَّ أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ ",
    after: "",
    answer: "الظَّالِمِينَ",
    others: ["الْغَافِلِينَ", "الْخَاطِئِينَ", "الْمُذْنِبِينَ"],
  },
  {
    sourceId: 14,
    before: "اللَّهُمَّ اجْعَلْنِي مِنَ التَّوَّابِينَ وَاجْعَلْنِي مِنَ ",
    after: "",
    answer: "الْمُتَطَهِّرِينَ",
    others: ["الصَّالِحِينَ", "الشَّاكِرِينَ", "الذَّاكِرِينَ"],
  },
  {
    sourceId: 216,
    before: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا ",
    after: "",
    answer: "خَلَقَ",
    others: ["نَزَلَ", "ظَهَرَ", "أَرَى"],
  },
  {
    sourceId: 48,
    before: "رَبِّ ",
    after: " لِي، رَبِّ اغْفِرْ لِي",
    answer: "اغْفِرْ",
    others: ["اسْتَجِبْ", "بَارِكْ", "يَسِّرْ"],
  },
  {
    sourceId: 125,
    before: "اللَّهُ اللَّهُ رَبِّي لاَ ",
    after: " بِهِ شَيْئاً",
    answer: "أُشْرِكُ",
    others: ["أَعْدِلُ", "أَسْتَبْدِلُ", "أُسَاوِي"],
  },
  {
    sourceId: 190,
    before: "بَارَكَ اللَّهُ لَكَ، وَبَارَكَ عَلَيْكَ، وَجَمَعَ بَيْنَكُمَا فِي ",
    after: "",
    answer: "خَيْرٍ",
    others: ["سَعَادَةٍ", "مَوَدَّةٍ", "عَافِيَةٍ"],
  },
] as const satisfies readonly DhikrTaskRowShape[];

export type DhikrTaskRow = (typeof DHIKR_TASK_ROWS)[number];
