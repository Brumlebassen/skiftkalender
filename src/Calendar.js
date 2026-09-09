import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
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
} from "date-fns";
import { nb } from "date-fns/locale";

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

const getShiftColor = (shift) => {
  switch (shift) {
    case "Fm":
      return { bg: "#bbf7d0", text: "#14532d", border: "#86efac" };
    case "Em":
      return { bg: "#fef08a", text: "#713f12", border: "#fde047" };
    case "N":
      return { bg: "#bae6fd", text: "#0369a1", border: "#7dd3fc" };
    case "12tFm":
      return { bg: "#22c55e", text: "#ffffff", border: "#16a34a" };
    case "12tN":
      return { bg: "#2563eb", text: "#ffffff", border: "#1d4ed8" };
    case "Fri":
      return { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" };
    default:
      return { bg: "#ffffff", text: "#1e293b", border: "#e2e8f0" };
  }
};

const SHIFT_COMMENTS_KEY = "@shiftComments";
const SELECTED_SHIFT_KEY = "@selectedShiftGroup";

const Calendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shiftGroup, setShiftGroup] = useState(3);
  const [comments, setComments] = useState({});
  const [selectedKey, setSelectedKey] = useState(null);
  const [selectedDateFormatted, setSelectedDateFormatted] = useState("");
  const [selectedShiftName, setSelectedShiftName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);

  // Last lagrede data ved oppstart
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const [savedComments, savedGroup] = await Promise.all([
          AsyncStorage.getItem(SHIFT_COMMENTS_KEY),
          AsyncStorage.getItem(SELECTED_SHIFT_KEY),
        ]);
        if (savedComments) {
          setComments(JSON.parse(savedComments));
        }
        if (savedGroup) {
          setShiftGroup(Number(savedGroup));
        }
      } catch (err) {
        console.warn("Kunne ikke laste lagrede data:", err);
      }
    };
    loadSavedData();
  }, []);

  const handleSelectShiftGroup = async (num) => {
    setShiftGroup(num);
    try {
      await AsyncStorage.setItem(SELECTED_SHIFT_KEY, num.toString());
    } catch (err) {
      console.warn("Kunne ikke lagre valgt skiftgruppe:", err);
    }
  };

  const handleDayPress = (day, shift) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const key = `${shiftGroup}-${dateStr}`;
    setSelectedKey(key);
    setSelectedDateFormatted(
      format(day, "EEEE d. MMMM yyyy", { locale: nb })
    );
    setSelectedShiftName(shift || "Fri");
    setCommentText(comments[key] || "");
    setShowCommentBox(true);
  };

  const handleSaveComment = async () => {
    if (!selectedKey) return;
    const trimmed = commentText.trim();
    const updated = { ...comments };
    if (trimmed) {
      updated[selectedKey] = trimmed;
    } else {
      delete updated[selectedKey];
    }
    setComments(updated);
    setShowCommentBox(false);

    try {
      await AsyncStorage.setItem(SHIFT_COMMENTS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Kunne ikke lagre kommentar:", err);
    }
  };

  const handleDeleteComment = async () => {
    if (!selectedKey) return;
    const updated = { ...comments };
    delete updated[selectedKey];
    setComments(updated);
    setShowCommentBox(false);

    try {
      await AsyncStorage.setItem(SHIFT_COMMENTS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Kunne ikke slette kommentar:", err);
    }
  };

  const handleGoToToday = () => {
    setCurrentMonth(new Date());
  };

  const monthTitle = format(currentMonth, "MMMM yyyy", { locale: nb });
  const formattedMonthTitle =
    monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  // Rutenett
  const monthStart = startOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const today = new Date();

  const daysGrid = [];
  let dayIterator = startDate;
  for (let i = 0; i < 42; i++) {
    daysGrid.push(dayIterator);
    dayIterator = addDays(dayIterator, 1);
  }

  // Gruppér i uker (6 uker x 7 dager)
  const weeks = [];
  for (let i = 0; i < 42; i += 7) {
    weeks.push(daysGrid.slice(i, i + 7));
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Skiftvelger fane */}
      <View style={styles.selectorCard}>
        <Text style={styles.selectorTitle}>Velg skiftgruppe:</Text>
        <View style={styles.shiftButtonGroup}>
          {[1, 2, 3, 4, 5].map((num) => {
            const isSelected = shiftGroup === num;
            return (
              <TouchableOpacity
                key={num}
                style={[
                  styles.shiftButton,
                  isSelected && styles.shiftButtonActive,
                ]}
                onPress={() => handleSelectShiftGroup(num)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.shiftButtonText,
                    isSelected && styles.shiftButtonTextActive,
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
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}
          activeOpacity={0.6}
        >
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleGoToToday} activeOpacity={0.7}>
          <Text style={styles.monthTitle}>{formattedMonthTitle}</Text>
          <Text style={styles.todayHint}>Trykk for å gå til i dag</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}
          activeOpacity={0.6}
        >
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Ukedager */}
      <View style={styles.weekDaysRow}>
        {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((dayName, idx) => (
          <View key={dayName} style={styles.weekDayCell}>
            <Text
              style={[
                styles.weekDayText,
                (idx === 5 || idx === 6) && styles.weekEndText,
              ]}
            >
              {dayName}
            </Text>
          </View>
        ))}
      </View>

      {/* Kalenderrutenett */}
      <View style={styles.gridContainer}>
        {weeks.map((week, weekIdx) => (
          <View key={weekIdx} style={styles.weekRow}>
            {week.map((d) => {
              const inCurrentMonth = isSameMonth(d, monthStart);
              const dateStr = format(d, "yyyy-MM-dd");
              const key = `${shiftGroup}-${dateStr}`;
              const shift = inCurrentMonth ? getShiftForDate(d, shiftGroup) : "";
              const colorInfo = getShiftColor(shift);
              const isCurrentDay = isSameDay(d, today);
              const hasComment = Boolean(comments[key]);

              if (!inCurrentMonth) {
                return (
                  <View
                    key={dateStr}
                    style={[styles.dayCell, styles.dayCellOutside]}
                  >
                    <Text style={styles.dayNumberOutside}>
                      {format(d, "d")}
                    </Text>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    {
                      backgroundColor: colorInfo.bg,
                      borderColor: colorInfo.border,
                    },
                    isCurrentDay && styles.todayCellBorder,
                  ]}
                  onPress={() => handleDayPress(d, shift)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dayHeader}>
                    <View
                      style={[
                        styles.dayNumberContainer,
                        isCurrentDay && styles.todayNumberContainer,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumberText,
                          isCurrentDay && styles.todayNumberText,
                        ]}
                      >
                        {format(d, "d")}
                      </Text>
                    </View>
                    {hasComment && (
                      <Text style={styles.commentIndicator}>📝</Text>
                    )}
                  </View>

                  <Text
                    style={[styles.shiftText, { color: colorInfo.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {shift}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Forklaring / fargeforklaring */}
      <View style={styles.legendContainer}>
        <Text style={styles.legendTitle}>Skiftfarger</Text>
        <View style={styles.legendGrid}>
          {[
            { label: "Fm (Formiddag)", shift: "Fm" },
            { label: "Em (Ettermiddag)", shift: "Em" },
            { label: "N (Natt)", shift: "N" },
            { label: "12tFm (12t Formiddag)", shift: "12tFm" },
            { label: "12tN (12t Natt)", shift: "12tN" },
            { label: "Fri", shift: "Fri" },
          ].map((item) => {
            const c = getShiftColor(item.shift);
            return (
              <View key={item.shift} style={styles.legendItem}>
                <View
                  style={[
                    styles.legendColorBox,
                    { backgroundColor: c.bg, borderColor: c.border },
                  ]}
                />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Modal for å legge inn kommentar/notat */}
      <Modal
        visible={showCommentBox}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCommentBox(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalDate}>{selectedDateFormatted}</Text>
            <View style={styles.modalShiftBadge}>
              <Text style={styles.modalShiftBadgeText}>
                Skift: {selectedShiftName} (Gruppe {shiftGroup})
              </Text>
            </View>

            <Text style={styles.modalInputLabel}>Notat for denne dagen:</Text>
            <TextInput
              style={styles.modalInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="F.eks. byttet vakt, overtid, ferie..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />

            <View style={styles.modalActions}>
              {selectedKey && comments[selectedKey] && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDeleteComment}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteButtonText}>Slett</Text>
                </TouchableOpacity>
              )}
              <View style={styles.modalRightActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowCommentBox(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Avbryt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveComment}
                  activeOpacity={0.7}
                >
                  <Text style={styles.saveButtonText}>Lagre</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  contentContainer: {
    padding: 12,
    paddingBottom: 40,
  },
  selectorCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  selectorTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
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
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  shiftButtonActive: {
    backgroundColor: "#1e3a8a",
  },
  shiftButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  shiftButtonTextActive: {
    color: "#ffffff",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  navButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginTop: -2,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    textAlign: "center",
  },
  todayHint: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
    marginTop: 2,
  },
  weekDaysRow: {
    flexDirection: "row",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  weekEndText: {
    color: "#ef4444",
  },
  gridContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    height: 58,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 2,
    padding: 3,
    justifyContent: "space-between",
  },
  dayCellOutside: {
    backgroundColor: "#f8fafc",
    borderColor: "transparent",
    opacity: 0.35,
  },
  todayCellBorder: {
    borderWidth: 2,
    borderColor: "#0284c7",
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayNumberContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  todayNumberContainer: {
    backgroundColor: "#0284c7",
  },
  dayNumberText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1e293b",
  },
  todayNumberText: {
    color: "#ffffff",
  },
  dayNumberOutside: {
    fontSize: 11,
    color: "#94a3b8",
    padding: 2,
  },
  commentIndicator: {
    fontSize: 10,
  },
  shiftText: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
  },
  legendContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "48%",
    marginBottom: 4,
  },
  legendColorBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalDate: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#0f172a",
    textTransform: "capitalize",
    marginBottom: 4,
  },
  modalShiftBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 14,
  },
  modalShiftBadgeText: {
    fontSize: 12,
    color: "#0369a1",
    fontWeight: "600",
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    height: 90,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalRightActions: {
    flexDirection: "row",
    gap: 8,
    marginLeft: "auto",
  },
  cancelButton: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  saveButton: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#1e3a8a",
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  deleteButton: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#dc2626",
  },
});

export default Calendar;
