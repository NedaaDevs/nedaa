import type { Stage } from "@/types/umrah";

export const UMRAH_STAGES: Stage[] = [
  {
    id: "ihram",
    titleKey: "umrah.stages.ihram.title",
    subtitleKey: "umrah.stages.ihram.subtitle",
    iconName: "shirt",
    steps: [
      {
        id: "ihram-miqat-ref",
        type: "reference",
        titleKey: "umrah.steps.ihram.miqat.title",
        descriptionKey: "umrah.steps.ihram.miqat.description",
        route: "/umrah/prepare/miqat",
      },
      {
        id: "ihram-ghusl",
        type: "instruction",
        titleKey: "umrah.steps.ihram.ghusl.title",
        descriptionKey: "umrah.steps.ihram.ghusl.description",
      },
      {
        id: "ihram-garments-ref",
        type: "reference",
        titleKey: "umrah.steps.ihram.garments.title",
        descriptionKey: "umrah.steps.ihram.garments.description",
        route: "/umrah/prepare/ihram",
      },
      {
        id: "ihram-prayer",
        type: "instruction",
        titleKey: "umrah.steps.ihram.prayer.title",
        descriptionKey: "umrah.steps.ihram.prayer.description",
      },
      {
        id: "ihram-niyyah",
        type: "dua",
        titleKey: "umrah.steps.ihram.niyyah.title",
        descriptionKey: "umrah.steps.ihram.niyyah.description",
        dua: {
          id: "niyyah",
          arabic: "اللَّهُمَّ إِنِّي أُرِيدُ الْعُمْرَةَ فَيَسِّرْهَا لِي وَتَقَبَّلْهَا مِنِّي",
          transliteration: {
            en: "Allāhumma innī urīdul-'umrata fa yassir-hā lī wa taqabbal-hā minnī",
            ms: "Allāhumma innī urīdul-'umrata fa yassir-hā lī wa taqabbal-hā minnī",
            ur: "اللہم انی ارید العمرۃ فیسرہا لی وتقبلہا منی",
          },
          translation: {
            en: "O Allah, I intend to perform Umrah, so make it easy for me and accept it from me.",
            ar: "دعاء نية العمرة عند الإحرام",
            ms: "Ya Allah, aku berniat untuk menunaikan Umrah, maka permudahkanlah untukku dan terimalah daripadaku.",
            ur: "اے اللہ! میں عمرہ کا ارادہ رکھتا ہوں، اسے میرے لیے آسان فرما اور مجھ سے قبول فرما۔",
          },
          source: "umrah.sources.commonSupplication",
        },
      },
      {
        id: "ihram-talbiyah",
        type: "dua",
        titleKey: "umrah.steps.ihram.talbiyah.title",
        descriptionKey: "umrah.steps.ihram.talbiyah.description",
        dua: {
          id: "talbiyah",
          arabic:
            "لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ، لَا شَرِيكَ لَكَ",
          transliteration: {
            en: "Labbayk Allāhumma labbayk, labbayk lā sharīka laka labbayk, inna al-ḥamda wan-ni'mata laka wal-mulk, lā sharīka lak",
            ms: "Labbayk Allāhumma labbayk, labbayk lā sharīka laka labbayk, inna al-ḥamda wan-ni'mata laka wal-mulk, lā sharīka lak",
            ur: "لبیک اللہم لبیک، لبیک لا شریک لک لبیک، ان الحمد والنعمۃ لک والملک، لا شریک لک",
          },
          translation: {
            en: "At Your service, Allah, at Your service. At Your service, You have no partner, at Your service. Truly all praise, favour and sovereignty is Yours. You have no partner.",
            ar: "لبيك اللهم لبيك، تلبية الإحرام بالعمرة",
            ms: "Aku memenuhi panggilan-Mu ya Allah, aku memenuhi panggilan-Mu. Aku memenuhi panggilan-Mu, tiada sekutu bagi-Mu, aku memenuhi panggilan-Mu. Sesungguhnya segala pujian, nikmat dan kerajaan adalah milik-Mu. Tiada sekutu bagi-Mu.",
            ur: "حاضر ہوں، اے اللہ میں حاضر ہوں، میں حاضر ہوں تیرا کوئی شریک نہیں، میں حاضر ہوں۔ بیشک تمام تعریفیں تیری ہیں، تمام نعمتیں تیری ہیں، اور بادشاہی تیری ہی ہے، تیرا کوئی شریک نہیں",
          },
          source: "umrah.sources.bukhariMuslim.talbiyah",
          hadithSource: "رواه البخاري ١٥٤٩ ومسلم ١١٨٤",
          hadithTranslation: "Narrated by al-Bukhari 1549 and Muslim 1184",
          repeatCount: 3,
        },
      },
      {
        id: "ihram-ishtiraat",
        type: "dua",
        titleKey: "umrah.steps.ihram.ishtiraat.title",
        descriptionKey: "umrah.steps.ihram.ishtiraat.description",
        dua: {
          id: "ishtiraat",
          arabic: "اللَّهُمَّ مَحِلِّي حَيْثُ حَبَسْتَنِي",
          transliteration: {
            en: "Allāhumma maḥillī ḥaythu ḥabastanī",
            ms: "Allāhumma maḥillī ḥaythu ḥabastanī",
            ur: "اللہم محلی حیث حبستنی",
          },
          translation: {
            en: "If anything prevents me, then my place is where You prevented me.",
            ar: "الاشتراط في الإحرام — يقال عند خوف عدم إتمام النسك",
            ms: "Jika ada sesuatu yang menghalangiku maka tempat aku bertahallul adalah di mana Engkau menahanku.",
            ur: "اگر کوئی رکاوٹ مانع ہوا تو میری جگہ وہیں ہے جہاں پر رکاوٹ پیش آئے۔",
          },
          source: "umrah.sources.bukhariMuslim.ishtiraat",
          hadithSource: "رواه البخاري ٥٠٨٩ ومسلم ١٢٠٧ من حديث ضُباعة بنت الزبير",
          hadithTranslation:
            "Narrated by al-Bukhari 5089 and Muslim 1207, from the hadith of Duba'ah bint al-Zubayr",
        },
      },
    ],
  },
  {
    id: "tawaf",
    titleKey: "umrah.stages.tawaf.title",
    subtitleKey: "umrah.stages.tawaf.subtitle",
    iconName: "rotate-ccw",
    steps: [
      {
        id: "tawaf-entry",
        type: "dua",
        titleKey: "umrah.steps.tawaf.entry.title",
        descriptionKey: "umrah.steps.tawaf.entry.description",
        dua: {
          id: "masjid-entry-dua",
          arabic:
            "بِسْمِ اللَّهِ وَالصَّلَاةُ وَالسَّلَامُ عَلَى رَسُولِ اللَّهِ، اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ",
          transliteration: {
            en: "Bismillāhi waṣ-ṣalātu was-salāmu 'alā rasūlillāh, Allāhummaftaḥ lī abwāba raḥmatik",
            ms: "Bismillāhi waṣ-ṣalātu was-salāmu 'alā rasūlillāh, Allāhummaftaḥ lī abwāba raḥmatik",
            ur: "بسم اللہ والصلاۃ والسلام علی رسول اللہ، اللہم افتح لی ابواب رحمتک",
          },
          translation: {
            en: "In the name of Allah, and peace and blessings upon the Messenger of Allah. O Allah, open for me the doors of Your mercy.",
            ar: "دعاء دخول المسجد الحرام",
            ms: "Dengan nama Allah, selawat dan salam ke atas Rasulullah. Ya Allah, bukakanlah untukku pintu-pintu rahmat-Mu.",
            ur: "اللہ کے نام سے، اور درود و سلام ہو رسول اللہ پر، اے اللہ! میرے لیے اپنی رحمت کے دروازے کھول دے۔",
          },
          source: "umrah.sources.muslimAbuDawud.entry",
          hadithSource: "رواه مسلم ٧١٣ وأبو داود ٤٦٥",
          hadithTranslation: "Narrated by Muslim 713 and Abu Dawud 465",
        },
      },
      {
        id: "tawaf-start",
        type: "dua",
        titleKey: "umrah.steps.tawaf.start.title",
        descriptionKey: "umrah.steps.tawaf.start.description",
        dua: {
          id: "tawaf-start-dua",
          arabic: "بِسْمِ اللَّهِ وَاللَّهُ أَكْبَرُ",
          transliteration: {
            en: "Bismillāhi wallāhu akbar",
            ms: "Bismillāhi wallāhu akbar",
            ur: "بسم اللہ واللہ اکبر",
          },
          translation: {
            en: "In the name of Allah, and Allah is the Greatest.",
            ar: "بسم الله والله أكبر — يقال عند استلام الحجر الأسود",
            ms: "Dengan nama Allah, dan Allah Maha Besar.",
            ur: "اللہ کے نام سے، اور اللہ سب سے بڑا ہے۔",
          },
          source: "umrah.sources.hisnulMuslim.tawaf",
          hadithSource: "حصن المسلم ٢٣٤، صحيح مسلم",
          hadithTranslation: "Hisnul Muslim 234, Sahih Muslim",
        },
      },
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `tawaf-lap-${i + 1}`,
        type: "lap" as const,
        titleKey: "umrah.steps.tawaf.lap.title",
        descriptionKey: i < 3 ? "umrah.steps.tawaf.lap.raml" : "umrah.steps.tawaf.lap.description",
        lapNumber: i + 1,
        dua: {
          id: "tawaf-rukn-yamani-dua",
          arabic:
            "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
          transliteration: {
            en: "Rabbanā ātinā fid-dunyā ḥasanatan wa fil-ākhirati ḥasanatan wa qinā 'adhāban-nār",
            ms: "Rabbanā ātinā fid-dunyā ḥasanatan wa fil-ākhirati ḥasanatan wa qinā 'adhāban-nār",
            ur: "ربنا آتنا فی الدنیا حسنۃ وفی الآخرۃ حسنۃ وقنا عذاب النار",
          },
          translation: {
            en: "Our Lord, give us in this world that which is good and in the Hereafter that which is good, and protect us from the punishment of the Fire.",
            ar: "ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار",
            ms: "Wahai Tuhan kami, berilah kami kebaikan di dunia dan kebaikan di akhirat, dan peliharalah kami dari azab neraka.",
            ur: "اے ہمارے رب! ہمیں دنیا میں بھلائی دے اور آخرت میں بھلائی دے اور ہمیں آگ کے عذاب سے بچا۔",
          },
          source: "umrah.sources.baqarahAbuDawud",
          hadithSource: "سورة البقرة ٢:٢٠١، أبو داود ١٨٩٢",
          hadithTranslation: "Surah Al-Baqarah 2:201, Abu Dawud 1892",
        },
      })),
      {
        id: "tawaf-checklist",
        type: "checklist",
        titleKey: "umrah.steps.tawaf.complete.title",
        descriptionKey: "umrah.steps.tawaf.complete.description",
        checklistItems: ["umrah.checklist.tawaf.prayer", "umrah.checklist.tawaf.zamzam"],
      },
    ],
  },
  {
    id: "sai",
    titleKey: "umrah.stages.sai.title",
    subtitleKey: "umrah.stages.sai.subtitle",
    iconName: "arrow-left-right",
    steps: [
      {
        id: "sai-safa-start",
        type: "dua",
        titleKey: "umrah.steps.sai.safaStart.title",
        descriptionKey: "umrah.steps.sai.safaStart.description",
        dua: {
          id: "sai-safa-dua",
          arabic: "إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَائِرِ اللَّهِ",
          transliteration: {
            en: "Innāṣ-ṣafā wal-marwata min sha'ā'irillāh",
            ms: "Innāṣ-ṣafā wal-marwata min sha'ā'irillāh",
            ur: "ان الصفا والمروۃ من شعائر اللہ",
          },
          translation: {
            en: "Indeed, Safa and Marwa are among the symbols of Allah.",
            ar: "إن الصفا والمروة من شعائر الله — يقال عند بداية السعي",
            ms: "Sesungguhnya Safa dan Marwah itu sebahagian daripada syiar (tanda kebesaran) Allah.",
            ur: "بیشک صفا و مروہ اللہ کے شعائر میں سے ہے",
          },
          source: "umrah.sources.baqarahMuslim.safa",
          hadithSource: "سورة البقرة ٢:١٥٨، صحيح مسلم ١٢١٨",
          hadithTranslation: "Surah Al-Baqarah 2:158, Sahih Muslim 1218",
        },
      },
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `sai-lap-${i + 1}`,
        type: "lap" as const,
        titleKey: "umrah.steps.sai.lap.title",
        descriptionKey: "umrah.steps.sai.lap.description",
        lapNumber: i + 1,
        lapDirection: (i % 2 === 0 ? "safaToMarwa" : "marwaToSafa") as
          | "safaToMarwa"
          | "marwaToSafa",
        dua: {
          id: "sai-general-dua",
          arabic:
            "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
          transliteration: {
            en: "Lā ilāha illallāhu waḥdahu lā sharīka lah, lahul-mulku wa lahul-ḥamdu wa huwa 'alā kulli shay'in qadīr",
            ms: "Lā ilāha illallāhu waḥdahu lā sharīka lah, lahul-mulku wa lahul-ḥamdu wa huwa 'alā kulli shay'in qadīr",
            ur: "لا الہ الا اللہ وحدہ لا شریک لہ، لہ الملک ولہ الحمد وہو علی کل شیء قدیر",
          },
          translation: {
            en: "There is no god but Allah alone, with no partner. His is the dominion and His is the praise, and He is able to do all things.",
            ar: "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير",
            ms: "Tiada tuhan melainkan Allah, Yang Maha Esa, tiada sekutu bagi-Nya. Bagi-Nya kerajaan dan bagi-Nya segala puji, dan Dia Maha Berkuasa atas segala sesuatu.",
            ur: "اللہ کے سوا کوئی معبود نہیں، وہ اکیلا ہے، اس کا کوئی شریک نہیں، بادشاہی اسی کی ہے اور تعریف اسی کی ہے اور وہ ہر چیز پر قادر ہے۔",
          },
          source: "umrah.sources.muslim.sai",
          hadithSource: "صحيح مسلم ١٢١٨",
          hadithTranslation: "Sahih Muslim 1218",
        },
      })),
      {
        id: "sai-complete",
        type: "instruction",
        titleKey: "umrah.steps.sai.complete.title",
        descriptionKey: "umrah.steps.sai.complete.description",
      },
    ],
  },
  {
    id: "tahallul",
    titleKey: "umrah.stages.tahallul.title",
    subtitleKey: "umrah.stages.tahallul.subtitle",
    iconName: "scissors",
    steps: [
      {
        id: "tahallul-barber",
        type: "instruction",
        titleKey: "umrah.steps.tahallul.barber.title",
        descriptionKey: "umrah.steps.tahallul.barber.description",
      },
      {
        id: "tahallul-haircut",
        type: "instruction",
        titleKey: "umrah.steps.tahallul.instruction.title",
        descriptionKey: "umrah.steps.tahallul.instruction.description",
      },
      {
        id: "tahallul-checklist",
        type: "checklist",
        titleKey: "umrah.steps.tahallul.complete.title",
        descriptionKey: "umrah.steps.tahallul.complete.description",
        checklistItems: ["umrah.checklist.tahallul.haircut"],
      },
    ],
  },
];

export const AUTO_RESET_DAYS = 3;
