import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Share,
  Platform,
} from "react-native";
import { format, addDays, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import { getShiftColor } from "./theme";
import { PRESET_SHIFT_PLANS, ALL_SHIFTS } from "./shiftCalculator";

const COMMON_CYCLE_LENGTHS = [
  { label: "1 veke (7d)", length: 7 },
  { label: "2 veker (14d)", length: 14 },
  { label: "3 veker (21d)", length: 21 },
  { label: "4 veker (28d)", length: 28 },
  { label: "5 veker (35d)", length: 35 },
  { label: "6 veker (42d)", length: 42 },
];

const AVAILABLE_SHIFT_CODES = [
  { code: "Fm", label: "Fm" },
  { code: "Em", label: "Em" },
  { code: "N", label: "Natt" },
  { code: "12tFm", label: "12t Fm" },
  { code: "12tN", label: "12t Natt" },
  { code: "Fri", label: "Fri" },
];

const TurnusBuilderModal = ({
  visible,
  onClose,
  activePlan,
  onSelectPlan,
  customPlans = [],
  onSaveCustomPlan,
  onDeleteCustomPlan,
  theme,
  isDark,
}) => {
  // Visningsmodus: 'list' (oversikt over planar) eller 'builder' (opprett/rediger)
  const [viewMode, setViewMode] = useState("list");

  // State for turnus-byggjar
  const [builderName, setBuilderName] = useState("");
  const [builderCategory, setBuilderCategory] = useState("Eigendefinert");
  const [builderCycleLength, setBuilderCycleLength] = useState(21);
  const [builderStartDate, setBuilderStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [builderNumGroups, setBuilderNumGroups] = useState(3);
  const [builderRotation, setBuilderRotation] = useState(Array(21).fill("Fri"));
  const [selectedBrushShift, setSelectedBrushShift] = useState("Fm");

  // State for import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");

  // Start bygging av ny plan
  const handleStartNewPlan = () => {
    setBuilderName("");
    setBuilderCategory("Eigendefinert");
    setBuilderCycleLength(21);
    setBuilderStartDate(format(new Date(), "yyyy-MM-dd"));
    setBuilderNumGroups(3);
    setBuilderRotation(Array(21).fill("Fri"));
    setSelectedBrushShift("Fm");
    setViewMode("builder");
  };

  // Endre sykluslengde
  const handleCycleLengthChange = (length) => {
    setBuilderCycleLength(length);
    setBuilderRotation((prev) => {
      const next = [...prev];
      if (length > prev.length) {
        while (next.length < length) next.push("Fri");
      } else {
        return next.slice(0, length);
      }
      return next;
    });
  };

  // Trykk på ein dag i syklusen for å fargelegge den med aktiv børste
  const handleDayPress = (dayIndex) => {
    setBuilderRotation((prev) => {
      const next = [...prev];
      // Viss dagen allereie har denne vakta, byt til Fri, elles sett vald vakt
      next[dayIndex] = next[dayIndex] === selectedBrushShift ? "Fri" : selectedBrushShift;
      return next;
    });
  };

  // Fyll heile veka med aktiv børste
  const handleFillWeek = (weekStartIndex) => {
    setBuilderRotation((prev) => {
      const next = [...prev];
      for (let i = 0; i < 7 && weekStartIndex + i < builderCycleLength; i++) {
        next[weekStartIndex + i] = selectedBrushShift;
      }
      return next;
    });
  };

  // Nullstill alle dagar til Fri
  const handleResetAllToFree = () => {
    setBuilderRotation(Array(builderCycleLength).fill("Fri"));
  };

  // Lagre den nye planen
  const handleSavePlan = () => {
    const trimmedName = builderName.trim();
    if (!trimmedName) {
      Alert.alert("Mangler namn", "Skriv inn eit namn på turnusplanen din (t.d. «Hydro 5-skift» eller «Min Turnus»).");
      return;
    }

    // Bygg grupper / skiftlag basert på numGroups
    const groups = [];
    const offsetStep = Math.floor(builderCycleLength / Math.max(1, builderNumGroups));

    for (let i = 1; i <= builderNumGroups; i++) {
      groups.push({
        id: i,
        name: `Lag ${i}`,
        date: builderStartDate,
        offsetDays: (i - 1) * offsetStep,
      });
    }

    const newPlan = {
      id: "custom-" + Date.now(),
      name: trimmedName,
      shortName: trimmedName.slice(0, 12),
      category: builderCategory || "Eigendefinert",
      description: `Eigendefinert turnus over ${builderCycleLength} dagar med ${builderNumGroups} skiftlag.`,
      cycleLength: builderCycleLength,
      baseRotation: builderRotation,
      groups,
      isPreset: false,
      shiftTypes: [
        { code: "Fm", name: "Formiddag", defaultTime: "07:00 - 15:00" },
        { code: "Em", name: "Ettermiddag", defaultTime: "15:00 - 23:00" },
        { code: "N", name: "Natt", defaultTime: "23:00 - 07:00" },
        { code: "12tFm", name: "12t Fm", defaultTime: "07:00 - 19:00" },
        { code: "12tN", name: "12t Natt", defaultTime: "19:00 - 07:00" },
        { code: "Fri", name: "Fridag", defaultTime: "Fri" },
      ],
    };

    onSaveCustomPlan(newPlan);
    onSelectPlan(newPlan);
    setViewMode("list");

    Alert.alert(
      "Turnusplan lagra! 🎉",
      `«${trimmedName}» er no aktiv i kalenderen din.`
    );
  };

  // Del plan som JSON
  const handleSharePlan = async (plan) => {
    try {
      const payload = JSON.stringify(plan);
      await Share.share({
        message: `Her er turnusplanen min for Skiftkalender (${plan.name}):\n\n${payload}`,
        title: `Turnusplan: ${plan.name}`,
      });
    } catch (err) {
      Alert.alert("Kunne ikkje dele", err.message);
    }
  };

  // Importer plan frå JSON
  const handleImportJson = () => {
    try {
      const cleaned = importText.trim();
      // Finn JSON i teksten om brukaren limte inn heile meldinga
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("Fann ingen gyldig turnus-kode i teksten.");
      }
      const jsonStr = cleaned.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonStr);

      if (!parsed.name || !parsed.cycleLength || !parsed.baseRotation) {
        throw new Error("Koden manglar påkravde felt (namn, sykluslengde eller rotasjon).");
      }

      const importedPlan = {
        ...parsed,
        id: "imported-" + Date.now(),
        isPreset: false,
      };

      onSaveCustomPlan(importedPlan);
      onSelectPlan(importedPlan);
      setShowImportModal(false);
      setImportText("");
      Alert.alert("Plan importert! 🎉", `«${importedPlan.name}» er no lagt til og vald som aktiv plan.`);
    } catch (err) {
      Alert.alert("Ugyldig kode", err.message || "Klarte ikkje å lese turnuskoden.");
    }
  };

  // Slett ein eigendefinert plan
  const handleDeletePlan = (plan) => {
    Alert.alert(
      "Slett turnusplan?",
      `Er du sikker på at du vil slette «${plan.name}»?`,
      [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Slett",
          style: "destructive",
          onPress: () => onDeleteCustomPlan(plan.id),
        },
      ]
    );
  };

  // Berekn vekedagar for visning i rutenettet
  const startDateObj = parseISO(builderStartDate) || new Date();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.modalOverlay }]}>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 22 }}>🏢</Text>
              <View>
                <Text style={[styles.title, { color: theme.textPrimary }]}>
                  {viewMode === "builder" ? "Turnus-byggjar" : "Turnusplanar"}
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {viewMode === "builder"
                    ? "Lag din eigen tilpassa skiftplan"
                    : "Vel eller lag turnus tilpassa di bedrift"}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.closeIcon, { color: theme.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ===================== MODUS 1: PLANLISTE ===================== */}
          {viewMode === "list" && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Topp-handlinger: Bygg ny / Importer */}
              <View style={styles.topActionsRow}>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: theme.activeButtonBg }]}
                  onPress={handleStartNewPlan}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryActionBtnText}>➕ Bygg ny turnus</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryActionBtn, { borderColor: theme.cardBorder }]}
                  onPress={() => setShowImportModal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.secondaryActionBtnText, { color: theme.textPrimary }]}>
                    📥 Lim inn plan
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SEKSJON: EIGENDEFINERTE PLANAR (viss finst) */}
              {customPlans.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                    DINE EIGNE PLANAR
                  </Text>
                  {customPlans.map((plan) => {
                    const isSelected = activePlan?.id === plan.id;
                    return (
                      <View
                        key={plan.id}
                        style={[
                          styles.planCard,
                          {
                            backgroundColor: theme.inputBg,
                            borderColor: isSelected ? "#0284c7" : theme.inputBorder,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                      >
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => onSelectPlan(plan)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={[styles.planTitle, { color: theme.textPrimary }]}>
                              {plan.name}
                            </Text>
                            {isSelected && (
                              <View style={styles.activeBadge}>
                                <Text style={styles.activeBadgeText}>✓ I BRUK</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.planDesc, { color: theme.textSecondary }]}>
                            {plan.description}
                          </Text>
                          <Text style={[styles.planMeta, { color: theme.textMuted }]}>
                            Syklus: {plan.cycleLength} dagar • {plan.groups?.length || 1} skiftlag
                          </Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 8 }}>
                          <TouchableOpacity
                            style={[styles.iconSmallBtn, { backgroundColor: theme.cardBg }]}
                            onPress={() => handleSharePlan(plan)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={{ fontSize: 13 }}>📤</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.iconSmallBtn, { backgroundColor: theme.cardBg }]}
                            onPress={() => handleDeletePlan(plan)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={{ fontSize: 13 }}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* SEKSJON: FERDIGE MALAR (PRESETS) */}
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                  FERDIGE TURNUS-MALAR I NOREG
                </Text>

                {PRESET_SHIFT_PLANS.map((plan) => {
                  const isSelected = (!activePlan && plan.id === "standard-35") || activePlan?.id === plan.id;
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[
                        styles.planCard,
                        {
                          backgroundColor: theme.inputBg,
                          borderColor: isSelected ? "#0284c7" : theme.inputBorder,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                      onPress={() => onSelectPlan(plan)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <Text style={[styles.planTitle, { color: theme.textPrimary }]}>
                            {plan.name}
                          </Text>
                          {isSelected && (
                            <View style={styles.activeBadge}>
                              <Text style={styles.activeBadgeText}>✓ I BRUK</Text>
                            </View>
                          )}
                        </View>

                        <Text style={[styles.planCategoryBadge, { color: isDark ? "#38bdf8" : "#0284c7" }]}>
                          🏢 {plan.category}
                        </Text>

                        <Text style={[styles.planDesc, { color: theme.textSecondary }]}>
                          {plan.description}
                        </Text>

                        <View style={styles.planChipsRow}>
                          <Text style={[styles.planMeta, { color: theme.textMuted }]}>
                            Syklus: {plan.cycleLength} dagar • {plan.groups?.length} lag
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.iconSmallBtn, { backgroundColor: theme.cardBg, marginLeft: 8 }]}
                        onPress={() => handleSharePlan(plan)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={{ fontSize: 13 }}>📤</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* ===================== MODUS 2: TURNUS-BYGGJAR ===================== */}
          {viewMode === "builder" && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 1. Namn & Kategori */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                  Namn på turnusplan:
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.inputText,
                    },
                  ]}
                  value={builderName}
                  onChangeText={setBuilderName}
                  placeholder="f.eks. Hydro Karmøy 5-skift"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              {/* 2. Sykluslengde */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                  Kor mange dagar varer rotasjonen? ({builderCycleLength} dagar)
                </Text>
                <View style={styles.cyclePresetsRow}>
                  {COMMON_CYCLE_LENGTHS.map((c) => {
                    const isSelected = builderCycleLength === c.length;
                    return (
                      <TouchableOpacity
                        key={c.length}
                        style={[
                          styles.cyclePresetChip,
                          { borderColor: isSelected ? "#0284c7" : theme.inputBorder },
                          isSelected && { backgroundColor: isDark ? "#0c4a6e" : "#e0f2fe" },
                        ]}
                        onPress={() => handleCycleLengthChange(c.length)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.cyclePresetChipText,
                            { color: isSelected ? (isDark ? "#38bdf8" : "#0369a1") : theme.textSecondary },
                            isSelected && { fontWeight: "bold" },
                          ]}
                        >
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 3. Tal på skiftlag */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
                  Tal på skiftlag / grupper:
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[1, 2, 3, 4, 5, 6].map((num) => {
                    const isSel = builderNumGroups === num;
                    return (
                      <TouchableOpacity
                        key={num}
                        style={[
                          styles.groupNumBtn,
                          { borderColor: isSel ? "#0284c7" : theme.inputBorder },
                          isSel && { backgroundColor: isDark ? "#0c4a6e" : "#e0f2fe" },
                        ]}
                        onPress={() => setBuilderNumGroups(num)}
                      >
                        <Text
                          style={[
                            styles.groupNumBtnText,
                            { color: isSel ? (isDark ? "#38bdf8" : "#0369a1") : theme.textSecondary },
                            isSel && { fontWeight: "bold" },
                          ]}
                        >
                          {num}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 4. Vaktbørste (Val av vakt som skal fyllast inn) */}
              <View style={[styles.brushSection, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                <Text style={[styles.brushTitle, { color: theme.textPrimary }]}>
                  🎨 Vel vakt for å teikne inn i kalenderen:
                </Text>
                <View style={styles.brushRow}>
                  {AVAILABLE_SHIFT_CODES.map((item) => {
                    const sc = getShiftColor(item.code, isDark);
                    const isSelected = selectedBrushShift === item.code;
                    return (
                      <TouchableOpacity
                        key={item.code}
                        style={[
                          styles.brushBtn,
                          { backgroundColor: sc.bg, borderColor: sc.border },
                          isSelected && {
                            borderColor: isDark ? "#ffffff" : "#0f172a",
                            borderWidth: 2.5,
                            transform: [{ scale: 1.06 }],
                          },
                        ]}
                        onPress={() => setSelectedBrushShift(item.code)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.brushBtnText, { color: sc.text }]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={[styles.brushHint, { color: theme.textMuted }]}>
                  Trykk på ein dag under for å sette «{selectedBrushShift}», eller trykk på veke-knappen for heile veka.
                </Text>
              </View>

              {/* 5. Interaktivt vakter-rutenett (Veke for veke) */}
              <View style={styles.gridContainer}>
                {Array.from({ length: Math.ceil(builderCycleLength / 7) }).map((_, weekIdx) => {
                  const weekStart = weekIdx * 7;
                  return (
                    <View key={weekIdx} style={styles.weekBlock}>
                      <View style={styles.weekHeaderRow}>
                        <Text style={[styles.weekLabel, { color: theme.textSecondary }]}>
                          Veke {weekIdx + 1}
                        </Text>
                        <TouchableOpacity
                          style={styles.fillWeekBtn}
                          onPress={() => handleFillWeek(weekStart)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.fillWeekBtnText, { color: isDark ? "#38bdf8" : "#0284c7" }]}>
                            Fyll veke med «{selectedBrushShift}»
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.weekDaysRow}>
                        {Array.from({ length: 7 }).map((__, dayOffset) => {
                          const dayIdx = weekStart + dayOffset;
                          if (dayIdx >= builderCycleLength) return <View key={dayOffset} style={styles.daySlotEmpty} />;

                          const shiftVal = builderRotation[dayIdx] || "Fri";
                          const sc = getShiftColor(shiftVal, isDark);
                          const dayDate = addDays(startDateObj, dayIdx);
                          const dayShort = format(dayDate, "EEE", { locale: nb }).slice(0, 3);

                          return (
                            <TouchableOpacity
                              key={dayOffset}
                              style={[
                                styles.daySlot,
                                { backgroundColor: sc.bg, borderColor: sc.border },
                              ]}
                              onPress={() => handleDayPress(dayIdx)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.daySlotNumber, { color: theme.textMuted }]}>
                                D{dayIdx + 1}
                              </Text>
                              <Text style={[styles.daySlotShort, { color: sc.text }]}>
                                {dayShort}
                              </Text>
                              <Text style={[styles.daySlotShift, { color: sc.text }]}>
                                {shiftVal}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Nullstill alle til Fri */}
              <TouchableOpacity
                style={[styles.resetFreeBtn, { borderColor: theme.cardBorder }]}
                onPress={handleResetAllToFree}
                activeOpacity={0.7}
              >
                <Text style={[styles.resetFreeBtnText, { color: theme.textMuted }]}>
                  🔕 Nullstill alle dagar til Fri
                </Text>
              </TouchableOpacity>

              {/* Handlingsknappar nedst */}
              <View style={styles.builderBottomRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.cardBorder }]}
                  onPress={() => setViewMode("list")}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>
                    Avbryt
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.savePlanBtn, { backgroundColor: theme.activeButtonBg }]}
                  onPress={handleSavePlan}
                  activeOpacity={0.8}
                >
                  <Text style={styles.savePlanBtnText}>
                    💾 Lagre og bruk plan
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ===================== MODAL FOR IMPORT ===================== */}
          <Modal visible={showImportModal} transparent animationType="fade">
            <View style={[styles.overlay, { backgroundColor: theme.modalOverlay }]}>
              <View style={[styles.importCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <Text style={[styles.title, { color: theme.textPrimary, marginBottom: 4 }]}>
                  📥 Importer turnusplan
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary, marginBottom: 12 }]}>
                  Lim inn turnus-koden du har fått delt frå ein kollega for å legge den til i appen din:
                </Text>

                <TextInput
                  style={[
                    styles.importInput,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.inputText,
                    },
                  ]}
                  multiline
                  numberOfLines={5}
                  value={importText}
                  onChangeText={setImportText}
                  placeholder="Lim inn turnus-kode her..."
                  placeholderTextColor={theme.textMuted}
                />

                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { flex: 1, borderColor: theme.cardBorder }]}
                    onPress={() => setShowImportModal(false)}
                  >
                    <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>
                      Avbryt
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.savePlanBtn, { flex: 1, backgroundColor: theme.activeButtonBg }]}
                    onPress={handleImportJson}
                  >
                    <Text style={styles.savePlanBtnText}>
                      Importer plan
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  card: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: "92%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: "600",
    padding: 4,
  },
  topActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  primaryActionBtn: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  planCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  planTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  activeBadge: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: "bold",
  },
  planCategoryBadge: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  planDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  planChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  planMeta: {
    fontSize: 11,
    fontWeight: "500",
  },
  iconSmallBtn: {
    padding: 7,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#cbd5e1",
  },
  // Byggjar-stilar
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
  },
  cyclePresetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cyclePresetChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cyclePresetChipText: {
    fontSize: 12,
  },
  groupNumBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  groupNumBtnText: {
    fontSize: 13,
  },
  brushSection: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  brushTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    marginBottom: 8,
  },
  brushRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  brushBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  brushBtnText: {
    fontSize: 11.5,
    fontWeight: "bold",
  },
  brushHint: {
    fontSize: 11,
    marginTop: 6,
    fontStyle: "italic",
  },
  gridContainer: {
    marginBottom: 12,
  },
  weekBlock: {
    marginBottom: 12,
  },
  weekHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  weekLabel: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  fillWeekBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  fillWeekBtnText: {
    fontSize: 11,
    fontWeight: "600",
  },
  weekDaysRow: {
    flexDirection: "row",
    gap: 4,
  },
  daySlot: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  daySlotEmpty: {
    flex: 1,
  },
  daySlotNumber: {
    fontSize: 8.5,
    fontWeight: "600",
  },
  daySlotShort: {
    fontSize: 9.5,
    fontWeight: "600",
    marginTop: 1,
  },
  daySlotShift: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 2,
  },
  resetFreeBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  resetFreeBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  builderBottomRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  savePlanBtn: {
    flex: 1.6,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  savePlanBtnText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "700",
  },
  importCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  importInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    textAlignVertical: "top",
    minHeight: 90,
  },
});

export default TurnusBuilderModal;
