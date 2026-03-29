import { addMinutes, parseISO } from "date-fns";

const ISHRAQ_OFFSET_MINUTES = 15;
const DUHA_FORENOON_FRACTION = 0.25;

export const calculateIshraq = (sunriseISO: string): Date => {
  const sunrise = parseISO(sunriseISO);
  return addMinutes(sunrise, ISHRAQ_OFFSET_MINUTES);
};

export const calculateDuha = (sunriseISO: string, dhuhrISO: string): Date => {
  const sunrise = parseISO(sunriseISO);
  const dhuhr = parseISO(dhuhrISO);
  const duration = dhuhr.getTime() - sunrise.getTime();
  return new Date(sunrise.getTime() + duration * DUHA_FORENOON_FRACTION);
};
