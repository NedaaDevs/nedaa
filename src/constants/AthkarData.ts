// Types
import { Athkar } from "@/types/athkar";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

export const DEFAULT_ATHKAR_DATA: Athkar[] = [
  {
    id: "1",
    title: "athkar.titles.ayatAlKursi",
    text: "athkar.items.ayatAlKursi",
    count: 1,
    type: ATHKAR_TYPE.ALL,
    order: 1,
  },

  {
    id: "2",
    title: "athkar.titles.threeQuls",
    text: "athkar.items.surahAlIkhlas",
    count: 9,
    type: ATHKAR_TYPE.ALL,
    order: 2,
    group: {
      texts: ["athkar.items.surahAlIkhlas", "athkar.items.surahAlFalaq", "athkar.items.surahAnNas"],
      audioIds: ["al-ikhlas", "al-falaq", "an-nas"],
      itemsPerRound: 3,
    },
  },

  {
    id: "5",
    title: "athkar.titles.morningPraise",
    text: "athkar.items.morningPraise",
    count: 1,
    type: ATHKAR_TYPE.MORNING,
    order: 5,
  },

  {
    id: "6",
    title: "athkar.titles.eveningPraise",
    text: "athkar.items.eveningPraise",
    count: 1,
    type: ATHKAR_TYPE.EVENING,
    order: 5,
  },

  {
    id: "7",
    title: "athkar.titles.morningByYourGrace",
    text: "athkar.items.morningByYourGrace",
    count: 1,
    type: ATHKAR_TYPE.MORNING,
    order: 6,
  },

  {
    id: "8",
    title: "athkar.titles.eveningByYourGrace",
    text: "athkar.items.eveningByYourGrace",
    count: 1,
    type: ATHKAR_TYPE.EVENING,
    order: 6,
  },

  {
    id: "9",
    title: "athkar.titles.sayyidAlIstighfar",
    text: "athkar.items.sayyidAlIstighfar",
    count: 1,
    type: ATHKAR_TYPE.ALL,
    order: 7,
  },

  {
    id: "10",
    title: "athkar.titles.morningWitness",
    text: "athkar.items.morningWitness",
    count: 4,
    type: ATHKAR_TYPE.MORNING,
    order: 8,
  },

  {
    id: "11",
    title: "athkar.titles.eveningWitness",
    text: "athkar.items.eveningWitness",
    count: 4,
    type: ATHKAR_TYPE.EVENING,
    order: 8,
  },

  {
    id: "12",
    title: "athkar.titles.morningGratitude",
    text: "athkar.items.morningGratitude",
    count: 1,
    type: ATHKAR_TYPE.MORNING,
    order: 9,
  },

  {
    id: "13",
    title: "athkar.titles.eveningGratitude",
    text: "athkar.items.eveningGratitude",
    count: 1,
    type: ATHKAR_TYPE.EVENING,
    order: 9,
  },

  {
    id: "14",
    title: "athkar.titles.seekingWellbeing",
    text: "athkar.items.seekingWellbeing",
    count: 3,
    type: ATHKAR_TYPE.ALL,
    order: 10,
  },

  {
    id: "15",
    title: "athkar.titles.hasbiAllah",
    text: "athkar.items.hasbiAllah",
    count: 7,
    type: ATHKAR_TYPE.ALL,
    order: 11,
  },

  {
    id: "16",
    title: "athkar.titles.seekingForgiveness",
    text: "athkar.items.seekingForgiveness",
    count: 1,
    type: ATHKAR_TYPE.ALL,
    order: 12,
  },

  {
    id: "17",
    title: "athkar.titles.knowerOfUnseen",
    text: "athkar.items.knowerOfUnseen",
    count: 1,
    type: ATHKAR_TYPE.ALL,
    order: 13,
  },

  {
    id: "18",
    title: "athkar.titles.inTheNameOfAllah",
    text: "athkar.items.inTheNameOfAllah",
    count: 3,
    type: ATHKAR_TYPE.ALL,
    order: 14,
  },

  {
    id: "19",
    title: "athkar.titles.contentWithAllah",
    text: "athkar.items.contentWithAllah",
    count: 3,
    type: ATHKAR_TYPE.ALL,
    order: 15,
  },

  {
    id: "20",
    title: "athkar.titles.yaHayyuYaQayyum",
    text: "athkar.items.yaHayyuYaQayyum",
    count: 1,
    type: ATHKAR_TYPE.ALL,
    order: 16,
  },

  {
    id: "21",
    title: "athkar.titles.morningLordOfWorlds",
    text: "athkar.items.morningLordOfWorlds",
    count: 1,
    type: ATHKAR_TYPE.MORNING,
    order: 17,
  },

  {
    id: "22",
    title: "athkar.titles.eveningLordOfWorlds",
    text: "athkar.items.eveningLordOfWorlds",
    count: 1,
    type: ATHKAR_TYPE.EVENING,
    order: 17,
  },

  {
    id: "23",
    title: "athkar.titles.morningFitrah",
    text: "athkar.items.morningFitrah",
    count: 1,
    type: ATHKAR_TYPE.MORNING,
    order: 18,
  },

  {
    id: "24",
    title: "athkar.titles.eveningFitrah",
    text: "athkar.items.eveningFitrah",
    count: 1,
    type: ATHKAR_TYPE.EVENING,
    order: 18,
  },

  {
    id: "25",
    title: "athkar.titles.subhanAllahWaBihamdihi",
    text: "athkar.items.subhanAllahWaBihamdihi",
    count: 100,
    type: ATHKAR_TYPE.ALL,
    order: 19,
  },

  {
    id: "26",
    title: "athkar.titles.laIlahaIllaAllahShort",
    text: "athkar.items.laIlahaIllaAllahFull",
    count: 10,
    type: ATHKAR_TYPE.MORNING,
    order: 20,
  },

  {
    id: "26",
    title: "athkar.titles.laIlahaIllaAllahLong",
    text: "athkar.items.laIlahaIllaAllahFull",
    count: 100,
    type: ATHKAR_TYPE.MORNING,
    order: 20,
  },

  {
    id: "27",
    title: "athkar.titles.laIlahaIllaAllahShort",
    text: "athkar.items.laIlahaIllaAllahFull",
    count: 10,
    type: ATHKAR_TYPE.EVENING,
    order: 20,
  },

  {
    id: "28",
    title: "athkar.titles.subhanAllahExtended",
    text: "athkar.items.subhanAllahExtended",
    count: 3,
    type: ATHKAR_TYPE.MORNING,
    order: 21,
  },

  {
    id: "29",
    title: "athkar.titles.subhanAllahExtended",
    text: "athkar.items.subhanAllahExtended",
    count: 3,
    type: ATHKAR_TYPE.EVENING,
    order: 21,
  },

  {
    id: "30",
    title: "athkar.titles.seekingBeneficialKnowledge",
    text: "athkar.items.seekingBeneficialKnowledge",
    count: 1,
    type: ATHKAR_TYPE.MORNING,
    order: 22,
  },
  {
    id: "31",
    title: "athkar.titles.seekingForgivenessRepentance",
    text: "athkar.items.astaghfirullah",
    count: 100,
    type: ATHKAR_TYPE.EVENING,
    order: 22,
  },
  {
    id: "32",
    title: "athkar.titles.seekingForgivenessRepentance",
    text: "athkar.items.astaghfirullah",
    count: 100,
    type: ATHKAR_TYPE.MORNING,
    order: 23,
  },

  {
    id: "33",
    title: "athkar.titles.perfectWordsOfAllah",
    text: "athkar.items.perfectWordsOfAllah",
    count: 3,
    type: ATHKAR_TYPE.EVENING,
    order: 23,
  },

  {
    id: "34",
    title: "athkar.titles.salawatOnProphet",
    text: "athkar.items.salawatOnProphet",
    count: 10,
    type: ATHKAR_TYPE.ALL,
    order: 24,
  },
];
