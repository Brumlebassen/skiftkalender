import { differenceInCalendarDays, format, parseISO } from "date-fns";

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

/**
 * Ferdiglagde turnus-malar for ulike bransjar i Noreg
 */
export const PRESET_SHIFT_PLANS = [
  {
    id: "standard-35",
    name: "35-dagars industri (Standard)",
    shortName: "35d Industri",
    category: "Industri & Fabrikk",
    description: "5-vekers rullerande skiftplan for Gruppe 1–5 med formiddag, ettermiddag, natt og 12-timars helgevakter.",
    cycleLength: 35,
    isPreset: true,
    groups: [
      { id: 1, name: "Gruppe 1", date: "2025-06-06", startCode: "12tFm" },
      { id: 2, name: "Gruppe 2", date: "2025-06-02", startCode: "Fm" },
      { id: 3, name: "Gruppe 3", date: "2025-06-04", startCode: "Em" },
      { id: 4, name: "Gruppe 4", date: "2025-06-09", startCode: "Fm" },
      { id: 5, name: "Gruppe 5", date: "2025-06-02", startCode: "N" },
    ],
    shiftTypes: [
      { code: "Fm", name: "Formiddag", defaultTime: "07:00 - 15:00" },
      { code: "Em", name: "Ettermiddag", defaultTime: "15:00 - 23:00" },
      { code: "N", name: "Natt", defaultTime: "23:00 - 07:00" },
      { code: "12tFm", name: "12t Formiddag", defaultTime: "07:00 - 19:00" },
      { code: "12tN", name: "12t Natt", defaultTime: "19:00 - 07:00" },
      { code: "Fri", name: "Fridag", defaultTime: "Fri" },
    ],
  },
  {
    id: "offshore-2-4",
    name: "2-4 Offshore (Nordsjøen)",
    shortName: "2-4 Offshore",
    category: "Olje, Gass & Maritimt",
    description: "Klassisk Nordsjøturnus: 14 dagar på jobb (12-timars vakter) etterfølgt av 28 dagar heimefri (42 dagars syklus).",
    cycleLength: 42,
    isPreset: true,
    baseRotation: [
      // 14 dagar på jobb (7 12tFm + 7 12tN)
      "12tFm", "12tFm", "12tFm", "12tFm", "12tFm", "12tFm", "12tFm",
      "12tN", "12tN", "12tN", "12tN", "12tN", "12tN", "12tN",
      // 28 dagar fri
      "Fri", "Fri", "Fri", "Fri", "Fri", "Fri", "Fri",
      "Fri", "Fri", "Fri", "Fri", "Fri", "Fri", "Fri",
      "Fri", "Fri", "Fri", "Fri", "Fri", "Fri", "Fri",
      "Fri", "Fri", "Fri", "Fri", "Fri", "Fri", "Fri",
    ],
    groups: [
      { id: 1, name: "Lag A", date: "2025-01-01", offsetDays: 0 },
      { id: 2, name: "Lag B", date: "2025-01-01", offsetDays: 14 },
      { id: 3, name: "Lag C", date: "2025-01-01", offsetDays: 28 },
    ],
    shiftTypes: [
      { code: "12tFm", name: "Offshore Dag (12t)", defaultTime: "07:00 - 19:00" },
      { code: "12tN", name: "Offshore Natt (12t)", defaultTime: "19:00 - 07:00" },
      { code: "Fri", name: "Heimeperiode (Fri)", defaultTime: "Fri" },
    ],
  },
  {
    id: "helse-3-veker",
    name: "3-vekers helseturnus",
    shortName: "3v Helse",
    category: "Helse, Omsorg & Sjukehus",
    description: "21 dagars rullerande turnus for sjukepleiarar og helsefagarbeidarar med dagvakter, kveldsvakter og helg.",
    cycleLength: 21,
    isPreset: true,
    baseRotation: [
      // Veke 1
      "Fm", "Fm", "Em", "Em", "Fri", "Fri", "Fri",
      // Veke 2
      "Fm", "Em", "Fri", "N", "N", "Fri", "Fri",
      // Veke 3 (Helg)
      "Fri", "Fm", "Em", "Fri", "Fm", "Fm", "Fri",
    ],
    groups: [
      { id: 1, name: "Turnusgruppe 1", date: "2025-01-06", offsetDays: 0 },
      { id: 2, name: "Turnusgruppe 2", date: "2025-01-06", offsetDays: 7 },
      { id: 3, name: "Turnusgruppe 3", date: "2025-01-06", offsetDays: 14 },
    ],
    shiftTypes: [
      { code: "Fm", name: "Dagvakt", defaultTime: "07:30 - 15:30" },
      { code: "Em", name: "Kveldsvakt", defaultTime: "15:00 - 22:30" },
      { code: "N", name: "Nattevakt", defaultTime: "22:00 - 07:30" },
      { code: "Fri", name: "Fridag", defaultTime: "Fri" },
    ],
  },
  {
    id: "kontinuerlig-5-skift",
    name: "5-skift kontinuerleg (2-2-2-4)",
    shortName: "2-2-2-4 Industri",
    category: "Prosess & Kontinuerleg drift",
    description: "Klassisk 10-dagars industrisyklus: 2 Formiddag, 2 Ettermiddag, 2 Natt, og 4 Fridagar.",
    cycleLength: 10,
    isPreset: true,
    baseRotation: [
      "Fm", "Fm", "Em", "Em", "N", "N", "Fri", "Fri", "Fri", "Fri",
    ],
    groups: [
      { id: 1, name: "Skift 1", date: "2025-01-01", offsetDays: 0 },
      { id: 2, name: "Skift 2", date: "2025-01-01", offsetDays: 2 },
      { id: 3, name: "Skift 3", date: "2025-01-01", offsetDays: 4 },
      { id: 4, name: "Skift 4", date: "2025-01-01", offsetDays: 6 },
      { id: 5, name: "Skift 5", date: "2025-01-01", offsetDays: 8 },
    ],
    shiftTypes: [
      { code: "Fm", name: "Formiddag", defaultTime: "06:00 - 14:00" },
      { code: "Em", name: "Ettermiddag", defaultTime: "14:00 - 22:00" },
      { code: "N", name: "Natt", defaultTime: "22:00 - 06:00" },
      { code: "Fri", name: "Fridag", defaultTime: "Fri" },
    ],
  },
];

/**
 * Reknar ut kva vakt som gjeld for ein gjeven dato og skiftgruppe.
 * Støttar både standard 35-dagars plan og eigendefinerte planar / malar.
 */
export const getShiftForDate = (date, shiftGroup, activePlan = null) => {
  // 1. Standard 35-dagars plan (100% bakoverkompatibel)
  if (!activePlan || activePlan.id === "standard-35") {
    const info = skiftStartInfo[shiftGroup] || skiftStartInfo[1];
    const { date: startDate, startCode } = info;
    const rotasjon = generateSkiftRotasjon(startCode);
    const daysDiff = differenceInCalendarDays(date, startDate);
    const index = ((daysDiff % 35) + 35) % 35;
    return rotasjon[index];
  }

  // 2. Eigendefinert plan eller ferdig mal
  const groupsList = activePlan.groups || [];
  let grp = null;

  if (Array.isArray(groupsList)) {
    grp = groupsList.find((g) => String(g.id) === String(shiftGroup)) || groupsList[0];
  } else if (typeof groupsList === "object") {
    grp = groupsList[shiftGroup] || Object.values(groupsList)[0];
  }

  if (!grp) return "Fri";

  const cycleLength = Number(activePlan.cycleLength) || grp.rotation?.length || 35;
  const rawDate = grp.date || "2025-01-01";
  const startDate = typeof rawDate === "string" ? parseISO(rawDate) : rawDate;

  const offset = Number(grp.offsetDays || 0);
  const daysDiff = differenceInCalendarDays(date, startDate) - offset;
  const index = ((daysDiff % cycleLength) + cycleLength) % cycleLength;

  const rotation = grp.rotation || activePlan.baseRotation;
  if (!rotation || !Array.isArray(rotation) || rotation.length === 0) {
    return "Fri";
  }

  return rotation[index] || "Fri";
};

/**
 * Reknar ut effektiv vakt for ein dato med omsyn til vaktbytte, overtid, ferie og aktiv plan
 */
export const getEffectiveShiftForDate = (date, shiftGroup, overrides = {}, activePlan = null) => {
  const dateStr = format(date, "yyyy-MM-dd");
  const dateKey = `${shiftGroup}-${dateStr}`;
  const override = overrides[dateKey];

  const rawShift = getShiftForDate(date, shiftGroup, activePlan);
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
export const ACTIVE_SHIFT_PLAN_KEY = "@activeShiftPlan";
export const CUSTOM_SHIFT_PLANS_KEY = "@customShiftPlans";

export const ALL_SHIFTS = ["Fm", "Em", "N", "12tFm", "12tN", "Fri"];

/**
 * Returnerer tilgjengelege vaktkoder for ein plan
 */
export const getShiftTypesForPlan = (activePlan) => {
  if (!activePlan || !activePlan.shiftTypes || activePlan.shiftTypes.length === 0) {
    return ALL_SHIFTS;
  }
  const codes = activePlan.shiftTypes.map((t) => t.code);
  if (!codes.includes("Fri")) codes.push("Fri");
  return codes;
};

/**
 * Returnerer lista over skiftgrupper/skiftlag for ein plan
 */
export const getGroupsForPlan = (activePlan) => {
  if (!activePlan || activePlan.id === "standard-35") {
    return [
      { id: 1, name: "Gruppe 1" },
      { id: 2, name: "Gruppe 2" },
      { id: 3, name: "Gruppe 3" },
      { id: 4, name: "Gruppe 4" },
      { id: 5, name: "Gruppe 5" },
    ];
  }

  if (Array.isArray(activePlan.groups)) {
    return activePlan.groups.map((g) => ({
      id: g.id,
      name: g.name || `Lag ${g.id}`,
    }));
  }

  if (typeof activePlan.groups === "object") {
    return Object.entries(activePlan.groups).map(([k, v]) => ({
      id: k,
      name: v.name || `Lag ${k}`,
    }));
  }

  return [{ id: 1, name: "Gruppe 1" }];
};
