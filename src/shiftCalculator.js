import { differenceInCalendarDays, format } from "date-fns";

export const baseRotasjon = [
  "Fm", "Fm", "Fm", "Fm", "Fri", "Fri", "Fri",
  "N", "N", "N", "N", "Fri", "Fri", "Fri",
  "Fri", "Fri", "Em", "Em", "12tN", "12tN", "12tN",
  "Fri", "Fri", "Fri", "Fri", "12tFm", "12tFm", "12tFm",
  "Em", "Em", "Fri", "Fri", "Fri", "Fri", "Fri",
];

export const skiftStartInfo = {
  1: { date: new Date(2025, 5, 6), startCode: "12tFm" },
  2: { date: new Date(2025, 5, 2), startCode: "Fm" },
  3: { date: new Date(2025, 5, 4), startCode: "Em" },
  4: { date: new Date(2025, 5, 9), startCode: "Fm" },
  5: { date: new Date(2025, 5, 2), startCode: "N" },
};

export const generateSkiftRotasjon = (startCode) => {
  const idx = baseRotasjon.indexOf(startCode);
  if (idx === -1) return baseRotasjon;
  return [...baseRotasjon.slice(idx), ...baseRotasjon.slice(0, idx)];
};

export const getShiftForDate = (date, shiftGroup) => {
  const info = skiftStartInfo[shiftGroup] || skiftStartInfo[1];
  const { date: startDate, startCode } = info;
  const rotasjon = generateSkiftRotasjon(startCode);
  const daysDiff = differenceInCalendarDays(date, startDate);
  const index = ((daysDiff % 35) + 35) % 35;
  return rotasjon[index];
};

export const getEffectiveShiftForDate = (date, shiftGroup, overrides = {}) => {
  const dateStr = format(date, "yyyy-MM-dd");
  const dateKey = `${shiftGroup}-${dateStr}`;
  const override = overrides[dateKey];

  const rawShift = getShiftForDate(date, shiftGroup);
  const isFerie = Boolean(override?.isFerie);
  const bytte = override?.bytteShift || (override?.shift && !override?.isOvertid ? override.shift : null);
  const overtid = override?.overtidShift || (override?.isOvertid ? (override.shift || rawShift) : null);

  let activeShift = rawShift;
  let badge = null; // 'ferie' | 'bytte' | 'overtid'

  if (isFerie) {
    activeShift = "Ferie";
    badge = "ferie";
  } else if (bytte) {
    activeShift = bytte;
    badge = "bytte";
  }

  if (overtid && !isFerie) {
    badge = "overtid";
  }

  return {
    rawShift,
    activeShift,
    isFerie,
    bytte,
    overtid,
    badge,
  };
};

export const SHIFT_COMMENTS_KEY = "@shiftComments";
export const SELECTED_SHIFT_KEY = "@selectedShiftGroup";
export const SHIFT_OVERRIDES_KEY = "@shiftOverrides";
export const SHIFT_TIMES_KEY = "@shiftTimes";
export const COMPARE_SHIFTS_KEY = "@compareShifts";

export const ALL_SHIFTS = ["Fm", "Em", "N", "12tFm", "12tN", "Fri"];
