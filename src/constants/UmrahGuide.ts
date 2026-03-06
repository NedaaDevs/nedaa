import type { Stage } from "@/types/umrah";

export const UMRAH_STAGES: Stage[] = [
  {
    id: "ihram",
    titleKey: "umrah.stages.ihram.title",
    subtitleKey: "umrah.stages.ihram.subtitle",
    iconName: "shirt",
    steps: [
      {
        id: "ihram-niyyah",
        type: "instruction",
        titleKey: "umrah.steps.ihram.niyyah.title",
        descriptionKey: "umrah.steps.ihram.niyyah.description",
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
            en: "Here I am, O Allah, here I am. Here I am, You have no partner, here I am. Verily all praise, grace, and sovereignty belong to You. You have no partner.",
            ar: "لبيك اللهم لبيك، تلبية الإحرام بالعمرة",
            ms: "Aku memenuhi panggilan-Mu ya Allah, aku memenuhi panggilan-Mu. Aku memenuhi panggilan-Mu, tiada sekutu bagi-Mu, aku memenuhi panggilan-Mu. Sesungguhnya segala puji, nikmat dan kerajaan adalah milik-Mu. Tiada sekutu bagi-Mu.",
            ur: "میں حاضر ہوں اے اللہ میں حاضر ہوں، میں حاضر ہوں تیرا کوئی شریک نہیں میں حاضر ہوں، بے شک تمام تعریف، نعمت اور بادشاہت تیری ہے، تیرا کوئی شریک نہیں",
          },
          source: "Sahih al-Bukhari 1549, Sahih Muslim 1184",
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
            ar: "بسم الله والله أكبر - يقال عند استلام الحجر الأسود",
            ms: "Dengan nama Allah, dan Allah Maha Besar.",
            ur: "اللہ کے نام سے، اور اللہ سب سے بڑا ہے۔",
          },
          source: "Hisnul Muslim 222, Sahih Muslim",
        },
      },
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `tawaf-lap-${i + 1}`,
        type: "lap" as const,
        titleKey: "umrah.steps.tawaf.lap.title",
        descriptionKey: "umrah.steps.tawaf.lap.description",
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
            en: "Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.",
            ar: "ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار",
            ms: "Wahai Tuhan kami, berilah kami kebaikan di dunia dan kebaikan di akhirat, dan peliharalah kami dari azab neraka.",
            ur: "اے ہمارے رب! ہمیں دنیا میں بھلائی دے اور آخرت میں بھلائی دے اور ہمیں آگ کے عذاب سے بچا۔",
          },
          source: "Surah Al-Baqarah 2:201, Abu Dawud 1892",
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
            ar: "إن الصفا والمروة من شعائر الله - يقال عند بداية السعي",
            ms: "Sesungguhnya Safa dan Marwa adalah antara tanda-tanda (kebesaran) Allah.",
            ur: "بے شک صفا اور مروہ اللہ کی نشانیوں میں سے ہیں۔",
          },
          source: "Surah Al-Baqarah 2:158, Sahih Muslim 1218",
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
          arabic: "رَبِّ اغْفِرْ وَارْحَمْ إِنَّكَ أَنْتَ الْأَعَزُّ الْأَكْرَمُ",
          transliteration: {
            en: "Rabbighfir warḥam innaka antal-a'azzul-akram",
            ms: "Rabbighfir warḥam innaka antal-a'azzul-akram",
            ur: "رب اغفر وارحم انک انت الاعز الاکرم",
          },
          translation: {
            en: "My Lord, forgive and have mercy, for You are the Most Mighty, the Most Noble.",
            ar: "رب اغفر وارحم إنك أنت الأعز الأكرم",
            ms: "Wahai Tuhanku, ampunilah dan rahmatilah, sesungguhnya Engkau Maha Perkasa lagi Maha Mulia.",
            ur: "اے میرے رب! بخش دے اور رحم فرما، بے شک تو ہی سب سے زیادہ عزت والا اور سب سے زیادہ کرم والا ہے۔",
          },
          source: "Reported by Ibn Majah, classified Sahih",
        },
      })),
    ],
  },
  {
    id: "tahallul",
    titleKey: "umrah.stages.tahallul.title",
    subtitleKey: "umrah.stages.tahallul.subtitle",
    iconName: "scissors",
    steps: [
      {
        id: "tahallul-instruction",
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
