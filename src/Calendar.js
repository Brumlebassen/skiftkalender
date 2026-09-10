import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  differenceInCalendarDays,
  getISOWeek,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { nb } from "date-fns/locale";
import { getTheme, getShiftColor } from "./theme";
import SettingsModal, { DEFAULT_SHIFT_TIMES } from "./SettingsModal";
import FerieModal from "./FerieModal";
import YearOverviewModal from "./YearOverviewModal";

const baseRotasjon = [
  "Fm", "Fm", "Fm", "Fm", "Fri", "Fri", "Fri",
  "N", "N", "N", "N", "Fri", "Fri", "Fri",
  "Fri", "Fri", "Em", "Em", "12tN", "12tN", "12tN",
  "Fri", "Fri", "Fri", "Fri", "12tFm", "12tFm", "12tFm",
  "Em", "Em", "Fri", "Fri", "Fri", "Fri", "Fri"
];

const skiftStartInfo = {
  1: { date: new Date(2025, 5, 6), startCode: "12tFm" },
  2: { date: new Date(2025, 5, 2), startCode: "Fm" },
  3: { date: new Date(2025, 5, 4), startCode: "Em" },
  4: { date: new Date(2025, 5, 9), startCode: "Fm" },
  5: { date: new Date(2025, 5, 2), startCode: "N" }
};

const generateSkiftRotasjon = (startCode) => {
  const idx = baseRotasjon.indexOf(startCode);
  if (idx === -1) return baseRotasjon;
  return [...baseRotasjon.slice(idx), ...baseRotasjon.slice(0, idx)];
};

const getShiftForDate = (date, shiftGroup) => {
  const { date: startDate, startCode } = skiftStartInfo[shiftGroup];
  const rotasjon = generateSkiftRotasjon(startCode);
  const daysDiff = differenceInCalendarDays(date, startDate);
  const index = ((daysDiff % 35) + 35) % 35;
  return rotasjon[index];
};

const SHIFT_COMMENTS_KEY = "@shiftComments";
const SELECTED_SHIFT_KEY = "@selectedShiftGroup";
const SHIFT_OVERRIDES_KEY = "@shiftOverrides";
const SHIFT_TIMES_KEY = "@shiftTimes";
const COMPARE_SHIFTS_KEY = "@compareShifts";

const ALL_SHIFTS = ["Fm", "Em", "N", "12tFm", "12tN", "Fri"];

const Calendar = ({ isDark, toggleTheme }) => {
  const theme = getTheme(isDark);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shiftGroup, setShiftGroup] = useState(3);
  const [comments, setComments] = useState({});
  const [overrides, setOverrides] = useState({});
  const [shiftTimes, setShiftTimes] = useState(DEFAULT_SHIFT_TIMES);

  // Samanlikningsmodus
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareGroups, setCompareGroups] = useState([3, 1]);

  // Modaler
  const [showSettings, setShowSettings] = useState(false);
  const [showFerieModal, setShowFerieModal] = useState(false);
  const [showYearOverview, setShowYearOverview] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);

  const handleSelectDateFromOverview = (dateObj) => {
    setCurrentMonth(dateObj);
    const rawShift = getShiftForDate(dateObj, shiftGroup);
    const dateStr = format(dateObj, "yyyy-MM-dd");
    const dateKey = `${shiftGroup}-${dateStr}`;
    handleDayPress(dateObj, rawShift, dateKey);
  };

  // Dag-modal tilstand
  const [activeDate, setActiveDate] = useState(null);
  const [originalShift, setOriginalShift] = useState("");
  const [bytteShift, setBytteShift] = useState(null);
  const [overtidShift, setOvertidShift] = useState(null);
  const [isFerie, setIsFerie] = useState(false);
  const [commentText, setCommentText] = useState("");

  // Last lagrede data ved oppstart
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const [
          savedComments,
          savedGroup,
          savedOverrides,
          savedTimes,
          savedCompare,
        ] = await Promise.all([
          AsyncStorage.getItem(SHIFT_COMMENTS_KEY),
          AsyncStorage.getItem(SELECTED_SHIFT_KEY),
          AsyncStorage.getItem(SHIFT_OVERRIDES_KEY),
          AsyncStorage.getItem(SHIFT_TIMES_KEY),
          AsyncStorage.getItem(COMPARE_SHIFTS_KEY),
        ]);

        if (savedComments) setComments(JSON.parse(savedComments));
        if (savedGroup) setShiftGroup(Number(savedGroup));
        if (savedOverrides) setOverrides(JSON.parse(savedOverrides));
        if (savedTimes) setShiftTimes(JSON.parse(savedTimes));
        if (savedCompare) setCompareGroups(JSON.parse(savedCompare));
      } catch (err) {
        console.warn("Kunne ikke laste lagrede data:", err);
      }
    };
    loadSavedData();
  }, []);

  // PanResponder for sveiping mellom måneder (swipe gestures)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 35 &&
          Math.abs(gestureState.dy) < Math.abs(gestureState.dx) * 0.8
        );
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx < -50) {
          setCurrentMonth((prev) => addMonths(prev, 1));
        } else if (gestureState.dx > 50) {
          setCurrentMonth((prev) => subMonths(prev, 1));
        }
      },
    })
  ).current;

  // Skiftvalg
  const handleSelectShiftGroup = async (num) => {
    setShiftGroup(num);
    try {
      await AsyncStorage.setItem(SELECTED_SHIFT_KEY, num.toString());
    } catch (err) {
      console.warn("Feil ved lagring av skiftgruppe:", err);
    }
  };

  // Toggle skift i samanlikningsmodus
  const handleToggleCompareGroup = async (num) => {
    let next;
    if (compareGroups.includes(num)) {
      if (compareGroups.length === 1) return;
      next = compareGroups.filter((g) => g !== num);
    } else {
      next = [...compareGroups, num].sort();
    }
    setCompareGroups(next);
    try {
      await AsyncStorage.setItem(COMPARE_SHIFTS_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn("Feil ved lagring av compare groups:", err);
    }
  };

  // Åpne dag-modal
  const handleDayPress = (day, defShift, dateKey) => {
    setActiveDate(day);
    setOriginalShift(defShift);

    const existing = overrides[dateKey];
    if (existing) {
      // Støtt både ny struktur og bakoverkompatibel struktur
      setBytteShift(existing.bytteShift || (existing.shift && !existing.isOvertid ? existing.shift : null));
      setOvertidShift(existing.overtidShift || (existing.isOvertid ? (existing.shift || defShift) : null));
      setIsFerie(Boolean(existing.isFerie));
    } else {
      setBytteShift(null);
      setOvertidShift(null);
      setIsFerie(false);
    }

    setCommentText(comments[dateKey] || "");
    setShowDayModal(true);
  };

  // Lagre endringer for en dag
  const handleSaveDay = async () => {
    if (!activeDate) return;
    const dateKey = `${shiftGroup}-${format(activeDate, "yyyy-MM-dd")}`;

    const updatedOverrides = { ...overrides };
    if (bytteShift || overtidShift || isFerie) {
      updatedOverrides[dateKey] = {
        bytteShift: bytteShift || null,
        overtidShift: overtidShift || null,
        isFerie: Boolean(isFerie),
      };
    } else {
      delete updatedOverrides[dateKey];
    }
    setOverrides(updatedOverrides);

    const trimmed = commentText.trim();
    const updatedComments = { ...comments };
    if (trimmed) {
      updatedComments[dateKey] = trimmed;
    } else {
      delete updatedComments[dateKey];
    }
    setComments(updatedComments);

    setShowDayModal(false);

    try {
      await Promise.all([
        AsyncStorage.setItem(SHIFT_OVERRIDES_KEY, JSON.stringify(updatedOverrides)),
        AsyncStorage.setItem(SHIFT_COMMENTS_KEY, JSON.stringify(updatedComments)),
      ]);
    } catch (err) {
      console.warn("Feil ved lagring:", err);
    }
  };

  // Tilbakestill dag til ren turnus
  const handleResetDay = async () => {
    if (!activeDate) return;
    const dateKey = `${shiftGroup}-${format(activeDate, "yyyy-MM-dd")}`;

    const updatedOverrides = { ...overrides };
    delete updatedOverrides[dateKey];
    setOverrides(updatedOverrides);

    const updatedComments = { ...comments };
    delete updatedComments[dateKey];
    setComments(updatedComments);

    setShowDayModal(false);

    try {
      await Promise.all([
        AsyncStorage.setItem(SHIFT_OVERRIDES_KEY, JSON.stringify(updatedOverrides)),
        AsyncStorage.setItem(SHIFT_COMMENTS_KEY, JSON.stringify(updatedComments)),
      ]);
    } catch (err) {
      console.warn("Feil ved sletting:", err);
    }
  };

  // Lagre ferieperiode (fra dato til dato)
  const handleSaveFeriePeriod = async (startDate, endDate) => {
    const updated = { ...overrides };
    let cur = new Date(startDate);
    const end = new Date(endDate);

    while (cur <= end) {
      const dateKey = `${shiftGroup}-${format(cur, "yyyy-MM-dd")}`;
      const existing = updated[dateKey] || {};
      updated[dateKey] = {
        ...existing,
        isFerie: true,
      };
      cur = addDays(cur, 1);
    }

    setOverrides(updated);
    try {
      await AsyncStorage.setItem(SHIFT_OVERRIDES_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Feil ved lagring av ferieperiode:", err);
    }
  };

  // Fjern ferie i periode
  const handleRemoveFeriePeriod = async (startDate, endDate) => {
    const updated = { ...overrides };
    let cur = new Date(startDate);
    const end = new Date(endDate);

    while (cur <= end) {
      const dateKey = `${shiftGroup}-${format(cur, "yyyy-MM-dd")}`;
      if (updated[dateKey]) {
        if (updated[dateKey].bytteShift || updated[dateKey].overtidShift) {
          updated[dateKey] = {
            ...updated[dateKey],
            isFerie: false,
          };
        } else {
          delete updated[dateKey];
        }
      }
      cur = addDays(cur, 1);
    }

    setOverrides(updated);
    try {
      await AsyncStorage.setItem(SHIFT_OVERRIDES_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Feil ved fjerning av ferieperiode:", err);
    }
  };

  // Lagre skifttider
  const handleSaveShiftTimes = async (newTimes) => {
    setShiftTimes(newTimes);
    try {
      await AsyncStorage.setItem(SHIFT_TIMES_KEY, JSON.stringify(newTimes));
    } catch (err) {
      console.warn("Feil ved lagring av skifttider:", err);
    }
  };

  const monthTitle = format(currentMonth, "MMMM yyyy", { locale: nb });
  const formattedMonthTitle =
    monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  // Rutenett og ukenummer
  const monthStart = startOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const today = new Date();

  const daysGrid = [];
  let dayIterator = startDate;
  for (let i = 0; i < 42; i++) {
    daysGrid.push(dayIterator);
    dayIterator = addDays(dayIterator, 1);
  }

  const weeks = [];
  for (let i = 0; i < 42; i += 7) {
    const weekDays = daysGrid.slice(i, i + 7);
    const weekNumber = getISOWeek(weekDays[0]);
    weeks.push({ weekNumber, days: weekDays });
  }

  // Tidsinfo i dag-modal
  const activeEffectiveShift = isFerie
    ? "Ferie"
    : bytteShift || originalShift;
  const currentModalTime = shiftTimes[activeEffectiveShift] || "";

  return (
    <View style={[styles.mainWrapper, { backgroundColor: theme.bg }]}>
      {/* Topp-verktøylinje */}
      <View style={[styles.topBar, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              isCompareMode && { backgroundColor: theme.activeButtonBg },
              !isCompareMode && { backgroundColor: theme.inactiveButtonBg },
            ]}
            onPress={() => setIsCompareMode(!isCompareMode)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.modeButtonText,
                { color: isCompareMode ? theme.activeButtonText : theme.inactiveButtonText },
              ]}
            >
              👥 {isCompareMode ? "Samanliknar" : "Samanlikn skift"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={[styles.overviewNavBtn, { backgroundColor: theme.inactiveButtonBg }]}
            onPress={() => setShowYearOverview(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.overviewNavBtnText, { color: theme.textPrimary }]}>📋 Oversikt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ferieNavBtn, { backgroundColor: theme.ferieBadgeBg }]}
            onPress={() => setShowFerieModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.ferieNavBtnText}>🏖️ Ferie</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.navButtonBg }]}
            onPress={() => setShowSettings(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.iconButtonText}>⚙️</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.navButtonBg }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Text style={styles.iconButtonText}>{isDark ? "☀️" : "🌙"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Skiftvelger */}
        <View style={[styles.selectorCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.selectorTitle, { color: theme.textMuted }]}>
            {isCompareMode
              ? "Vel skift å samanlikne (trykk på fleire):"
              : "Vel skiftgruppe:"}
          </Text>
          <View style={styles.shiftButtonGroup}>
            {[1, 2, 3, 4, 5].map((num) => {
              const isSelected = isCompareMode
                ? compareGroups.includes(num)
                : shiftGroup === num;

              return (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.shiftButton,
                    { backgroundColor: theme.inactiveButtonBg },
                    isSelected && { backgroundColor: theme.activeButtonBg },
                  ]}
                  onPress={() =>
                    isCompareMode
                      ? handleToggleCompareGroup(num)
                      : handleSelectShiftGroup(num)
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.shiftButtonText,
                      { color: isSelected ? theme.activeButtonText : theme.inactiveButtonText },
                    ]}
                  >
                    Skift {num}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Måneds-navigator */}
        <View style={[styles.headerContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: theme.navButtonBg }]}
            onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}
            activeOpacity={0.6}
          >
            <Text style={[styles.navButtonText, { color: theme.navButtonText }]}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setCurrentMonth(new Date())} activeOpacity={0.7}>
            <Text style={[styles.monthTitle, { color: theme.textPrimary }]}>{formattedMonthTitle}</Text>
            <Text style={[styles.todayHint, { color: theme.textMuted }]}>
              Trykk for «I dag» • Sveip for å bla
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: theme.navButtonBg }]}
            onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}
            activeOpacity={0.6}
          >
            <Text style={[styles.navButtonText, { color: theme.navButtonText }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Ukedags-overskrift (med Uke-kolonne) */}
        <View style={styles.weekDaysRow}>
          <View style={styles.weekNumberHeaderCell}>
            <Text style={[styles.weekNumberHeaderText, { color: theme.weekHeaderColor }]}>
              Uke
            </Text>
          </View>
          {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((dayName, idx) => (
            <View key={dayName} style={styles.weekDayCell}>
              <Text
                style={[
                  styles.weekDayText,
                  { color: theme.weekHeaderColor },
                  (idx === 5 || idx === 6) && { color: theme.weekEndColor },
                ]}
              >
                {dayName}
              </Text>
            </View>
          ))}
        </View>

        {/* Kalenderrutenett med PanResponder for sveiping */}
        <View
          style={[styles.gridContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
          {...panResponder.panHandlers}
        >
          {weeks.map(({ weekNumber, days }, weekIdx) => (
            <View key={weekIdx} style={styles.weekRow}>
              {/* Ukenummer-celle */}
              <View style={[styles.weekNumberCell, { backgroundColor: theme.weekNumberBg }]}>
                <Text style={[styles.weekNumberText, { color: theme.weekNumberText }]}>
                  {weekNumber}
                </Text>
              </View>

              {/* Dags-celler */}
              {days.map((d) => {
                const inCurrentMonth = isSameMonth(d, monthStart);
                const dateStr = format(d, "yyyy-MM-dd");
                const dateKey = `${shiftGroup}-${dateStr}`;
                const isCurrentDay = isSameDay(d, today);
                const hasComment = Boolean(comments[dateKey]);

                if (!inCurrentMonth) {
                  return (
                    <View
                      key={dateStr}
                      style={[styles.dayCell, { backgroundColor: theme.outsideCellBg, borderColor: "transparent" }]}
                    >
                      <Text style={[styles.dayNumberOutside, { color: theme.outsideCellText }]}>
                        {format(d, "d")}
                      </Text>
                    </View>
                  );
                }

                // Samanlikningsmodus
                if (isCompareMode) {
                  return (
                    <View
                      key={dateStr}
                      style={[
                        styles.dayCell,
                        styles.compareDayCell,
                        { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                        isCurrentDay && { borderColor: theme.todayBorder, borderWidth: 2 },
                      ]}
                    >
                      <View style={styles.dayHeader}>
                        <View
                          style={[
                            styles.dayNumberContainer,
                            isCurrentDay && { backgroundColor: theme.todayBorder },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayNumberText,
                              { color: isCurrentDay ? "#ffffff" : theme.textPrimary },
                            ]}
                          >
                            {format(d, "d")}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.compareShiftsList}>
                        {compareGroups.map((grp) => {
                          const s = getShiftForDate(d, grp);
                          const sc = getShiftColor(s, isDark);
                          return (
                            <View
                              key={grp}
                              style={[
                                styles.compareShiftPill,
                                { backgroundColor: sc.bg, borderColor: sc.border },
                              ]}
                            >
                              <Text
                                style={[styles.compareShiftPillText, { color: sc.text }]}
                                numberOfLines={1}
                              >
                                S{grp}: {s}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                }

                // Enkelt-skift visning
                const rawShift = getShiftForDate(d, shiftGroup);
                const override = overrides[dateKey];
                const dayIsFerie = Boolean(override?.isFerie);
                const dayByttet = override?.bytteShift || (override?.shift && !override?.isOvertid ? override.shift : null);
                const dayOvertid = override?.overtidShift || (override?.isOvertid ? (override.shift || rawShift) : null);

                // Bestem aktiv visningsvakt og farge
                let displayShift = rawShift;
                let displayColor = getShiftColor(rawShift, isDark);

                if (dayIsFerie) {
                  displayShift = "🏖️ Ferie";
                  displayColor = getShiftColor("Ferie", isDark);
                } else if (dayByttet) {
                  displayShift = dayByttet;
                  displayColor = getShiftColor(dayByttet, isDark);
                } else if (dayOvertid && rawShift === "Fri") {
                  // Tok overtid på ein fridag
                  displayShift = dayOvertid;
                  displayColor = getShiftColor(dayOvertid, isDark);
                }

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.dayCell,
                      {
                        backgroundColor: displayColor.bg,
                        borderColor: displayColor.border,
                      },
                      isCurrentDay && { borderColor: theme.todayBorder, borderWidth: 2 },
                    ]}
                    onPress={() => handleDayPress(d, rawShift, dateKey)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dayHeader}>
                      <View
                        style={[
                          styles.dayNumberContainer,
                          isCurrentDay && { backgroundColor: theme.todayBorder },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumberText,
                            { color: isCurrentDay ? "#ffffff" : displayColor.text },
                          ]}
                        >
                          {format(d, "d")}
                        </Text>
                      </View>

                      {/* Merke-rad: Vaktbytte (Lilla 🔄), Overtid (Oransje ⚡), Notat 📝 */}
                      <View style={styles.badgeRow}>
                        {dayByttet && !dayIsFerie && (
                          <View
                            style={[
                              styles.symbolBadge,
                              { backgroundColor: theme.bytteBadgeBg },
                            ]}
                          >
                            <Text style={styles.symbolBadgeText}>🔄</Text>
                          </View>
                        )}
                        {dayOvertid && !dayIsFerie && (
                          <View
                            style={[
                              styles.symbolBadge,
                              { backgroundColor: theme.overtidBadgeBg },
                            ]}
                          >
                            <Text style={styles.symbolBadgeText}>⚡</Text>
                          </View>
                        )}
                        {hasComment && (
                          <Text style={styles.commentIndicator}>📝</Text>
                        )}
                      </View>
                    </View>

                    <Text
                      style={[styles.shiftText, { color: displayColor.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {displayShift}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Fargeforklaring med skifttider, ferie og merker */}
        <View style={[styles.legendContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.legendTitle, { color: theme.textSecondary }]}>
            Skift, ferie og merker
          </Text>
          <View style={styles.legendGrid}>
            {[
              { label: "Fm (Formiddag)", shift: "Fm" },
              { label: "Em (Ettermiddag)", shift: "Em" },
              { label: "N (Natt)", shift: "N" },
              { label: "12tFm (12t Formiddag)", shift: "12tFm" },
              { label: "12tN (12t Natt)", shift: "12tN" },
              { label: "Fri", shift: "Fri" },
              { label: "🏖️ Ferie", shift: "Ferie" },
            ].map((item) => {
              const c = getShiftColor(item.shift, isDark);
              const time = shiftTimes[item.shift] || "";
              return (
                <View key={item.shift} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendColorBox,
                      { backgroundColor: c.bg, borderColor: c.border },
                    ]}
                  />
                  <View style={styles.legendTextContainer}>
                    <Text style={[styles.legendText, { color: theme.textPrimary }]}>
                      {item.label}
                    </Text>
                    {time ? (
                      <Text style={[styles.legendTimeText, { color: theme.textMuted }]}>
                        {time}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Forklaring for symboler: Vaktbytte og Overtid */}
          <View style={styles.symbolLegendRow}>
            <View style={styles.symbolLegendItem}>
              <View style={[styles.symbolBadgeLarge, { backgroundColor: theme.bytteBadgeBg }]}>
                <Text style={styles.symbolBadgeLargeText}>🔄</Text>
              </View>
              <Text style={[styles.symbolLegendLabel, { color: theme.textPrimary }]}>
                Vaktbytte (Lilla)
              </Text>
            </View>

            <View style={styles.symbolLegendItem}>
              <View style={[styles.symbolBadgeLarge, { backgroundColor: theme.overtidBadgeBg }]}>
                <Text style={styles.symbolBadgeLargeText}>⚡</Text>
              </View>
              <Text style={[styles.symbolLegendLabel, { color: theme.textPrimary }]}>
                Overtid (Oransje)
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Innstillings-modal for klokkeslett */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        shiftTimes={shiftTimes}
        onSaveShiftTimes={handleSaveShiftTimes}
        theme={theme}
      />

      {/* Ferie-modal for heile periodar */}
      <FerieModal
        visible={showFerieModal}
        onClose={() => setShowFerieModal(false)}
        onSaveFeriePeriod={handleSaveFeriePeriod}
        onRemoveFeriePeriod={handleRemoveFeriePeriod}
        theme={theme}
      />

      {/* Årsoversikt-modal for overtid og ferie */}
      <YearOverviewModal
        visible={showYearOverview}
        onClose={() => setShowYearOverview(false)}
        overrides={overrides}
        comments={comments}
        shiftGroup={shiftGroup}
        shiftTimes={shiftTimes}
        theme={theme}
        isDark={isDark}
        onSelectDate={handleSelectDateFromOverview}
      />

      {/* Dag-modal for vaktbytte, overtid, ferie og notater */}
      <Modal
        visible={showDayModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDayModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}
        >
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalDate, { color: theme.textPrimary }]}>
                {activeDate
                  ? format(activeDate, "EEEE d. MMMM yyyy", { locale: nb })
                  : ""}
              </Text>

              {/* Turnusinfo */}
              <View style={[styles.modalInfoBox, { backgroundColor: theme.inactiveButtonBg }]}>
                <Text style={[styles.modalOriginalShiftText, { color: theme.textSecondary }]}>
                  Turnusvakt:{" "}
                  <Text style={{ fontWeight: "bold", color: theme.textPrimary }}>
                    {originalShift}
                  </Text>{" "}
                  (Gruppe {shiftGroup})
                </Text>
                {currentModalTime ? (
                  <Text style={[styles.modalTimeText, { color: theme.textMuted }]}>
                    ⏰ Arbeidstid: {currentModalTime}
                  </Text>
                ) : null}
              </View>

              {/* 1. FERIE-VELGER */}
              <TouchableOpacity
                style={[
                  styles.ferieToggleBtn,
                  { backgroundColor: theme.inactiveButtonBg, borderColor: theme.cardBorder },
                  isFerie && { backgroundColor: theme.ferieBadgeBg },
                ]}
                onPress={() => setIsFerie(!isFerie)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.ferieToggleBtnText,
                    { color: isFerie ? "#ffffff" : theme.textPrimary },
                  ]}
                >
                  {isFerie ? "✓ Merka som Ferie (🏖️)" : "🏖️ Merk denne dagen som Ferie"}
                </Text>
              </TouchableOpacity>

              {!isFerie && (
                <>
                  {/* 2. VAKTBYTTE (LILLA 🔄) */}
                  <View style={styles.sectionHeader}>
                    <View style={[styles.symbolBadgeSmall, { backgroundColor: theme.bytteBadgeBg }]}>
                      <Text style={styles.symbolBadgeSmallText}>🔄</Text>
                    </View>
                    <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>
                      Vaktbytte (velg vakt du bytte til):
                    </Text>
                  </View>
                  <View style={styles.chipsRow}>
                    {ALL_SHIFTS.map((s) => {
                      const isSelected = bytteShift === s;
                      const sc = getShiftColor(s, isDark);
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.overrideChip,
                            { backgroundColor: sc.bg, borderColor: sc.border },
                            isSelected && {
                              backgroundColor: theme.bytteBadgeBg,
                              borderColor: theme.bytteBadgeBg,
                              borderWidth: 2,
                            },
                          ]}
                          onPress={() => setBytteShift(isSelected ? null : s)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.overrideChipText,
                              { color: isSelected ? "#ffffff" : sc.text },
                            ]}
                          >
                            {s}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* 3. OVERTID (ORANSJE ⚡) */}
                  <View style={styles.sectionHeader}>
                    <View style={[styles.symbolBadgeSmall, { backgroundColor: theme.overtidBadgeBg }]}>
                      <Text style={styles.symbolBadgeSmallText}>⚡</Text>
                    </View>
                    <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>
                      Overtid / Ekstravakt (velg vakt du tok):
                    </Text>
                  </View>
                  <View style={styles.chipsRow}>
                    {ALL_SHIFTS.filter((s) => s !== "Fri").map((s) => {
                      const isSelected = overtidShift === s;
                      const sc = getShiftColor(s, isDark);
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.overrideChip,
                            { backgroundColor: sc.bg, borderColor: sc.border },
                            isSelected && {
                              backgroundColor: theme.overtidBadgeBg,
                              borderColor: theme.overtidBadgeBg,
                              borderWidth: 2,
                            },
                          ]}
                          onPress={() => setOvertidShift(isSelected ? null : s)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.overrideChipText,
                              { color: isSelected ? "#ffffff" : sc.text },
                            ]}
                          >
                            {s}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* 4. NOTAT */}
              <Text style={[styles.modalSectionTitle, { color: theme.textSecondary, marginTop: 10 }]}>
                📝 Notat for denne dagen:
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.inputText,
                  },
                ]}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="F.eks. bytta med Arne, tok 12t overtid..."
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Handlingsknappar */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.deleteButton, { borderColor: theme.cardBorder }]}
                  onPress={handleResetDay}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteButtonText}>Tilbakestill</Text>
                </TouchableOpacity>

                <View style={styles.modalRightActions}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: theme.inactiveButtonBg }]}
                    onPress={() => setShowDayModal(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.cancelButtonText, { color: theme.inactiveButtonText }]}>
                      Avbryt
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: theme.activeButtonBg }]}
                    onPress={handleSaveDay}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.saveButtonText, { color: theme.activeButtonText }]}>
                      Lagre
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 12,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  overviewNavBtn: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 18,
  },
  overviewNavBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  ferieNavBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
  },
  ferieNavBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonText: {
    fontSize: 15,
  },
  selectorCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  selectorTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  shiftButtonGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  shiftButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
  },
  shiftButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  navButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: -2,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: "bold",
    textAlign: "center",
  },
  todayHint: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
  weekDaysRow: {
    flexDirection: "row",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekNumberHeaderCell: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
  weekNumberHeaderText: {
    fontSize: 11,
    fontWeight: "800",
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: "700",
  },
  gridContainer: {
    borderRadius: 14,
    padding: 3,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  weekNumberCell: {
    width: 26,
    height: 58,
    borderRadius: 6,
    marginRight: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  weekNumberText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dayCell: {
    flex: 1,
    height: 58,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 1.5,
    padding: 2,
    justifyContent: "space-between",
  },
  compareDayCell: {
    padding: 2,
    justifyContent: "flex-start",
  },
  compareShiftsList: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  compareShiftPill: {
    borderRadius: 4,
    paddingVertical: 1,
    paddingHorizontal: 2,
    borderWidth: 0.5,
  },
  compareShiftPillText: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayNumberContainer: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    justifyContent: "center",
    alignItems: "center",
  },
  dayNumberText: {
    fontSize: 10,
    fontWeight: "700",
  },
  dayNumberOutside: {
    fontSize: 11,
    padding: 2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1.5,
  },
  symbolBadge: {
    width: 14,
    height: 14,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  symbolBadgeText: {
    fontSize: 8,
  },
  commentIndicator: {
    fontSize: 8,
  },
  shiftText: {
    fontSize: 10.5,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 1,
  },
  legendContainer: {
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "48%",
    marginBottom: 8,
  },
  legendColorBox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 6,
    marginTop: 2,
  },
  legendTextContainer: {
    flex: 1,
  },
  legendText: {
    fontSize: 12,
    fontWeight: "600",
  },
  legendTimeText: {
    fontSize: 10,
    marginTop: 1,
  },
  symbolLegendRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#cbd5e1",
  },
  symbolLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  symbolBadgeLarge: {
    width: 18,
    height: 18,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  symbolBadgeLargeText: {
    fontSize: 10,
  },
  symbolLegendLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "90%",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  modalDate: {
    fontSize: 16,
    fontWeight: "bold",
    textTransform: "capitalize",
    marginBottom: 8,
  },
  modalInfoBox: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  modalOriginalShiftText: {
    fontSize: 13,
  },
  modalTimeText: {
    fontSize: 12,
    marginTop: 2,
  },
  ferieToggleBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 10,
  },
  ferieToggleBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    marginBottom: 6,
  },
  symbolBadgeSmall: {
    width: 16,
    height: 16,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  symbolBadgeSmallText: {
    fontSize: 9,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  overrideChip: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  overrideChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    height: 65,
    marginBottom: 14,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalRightActions: {
    flexDirection: "row",
    gap: 8,
  },
  deleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ef4444",
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
});

export default Calendar;
