import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { format, parseISO, addDays, differenceInCalendarDays } from "date-fns";
import { nb } from "date-fns/locale";
import { getShiftColor } from "./theme";

const YearOverviewModal = ({
  visible,
  onClose,
  overrides,
  comments,
  shiftGroup,
  shiftTimes,
  theme,
  isDark,
  onSelectDate,
}) => {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [activeTab, setActiveTab] = useState("overtid"); // 'overtid' | 'ferie'

  // Finn alle overtidsskift for valgt år
  const overtidItems = useMemo(() => {
    if (!overrides) return [];
    const items = [];

    Object.entries(overrides).forEach(([key, val]) => {
      const firstDash = key.indexOf("-");
      if (firstDash === -1) return;
      const grp = Number(key.slice(0, firstDash));
      const dateStr = key.slice(firstDash + 1);

      if (grp === shiftGroup && dateStr.startsWith(`${selectedYear}-`)) {
        const otShift = val.overtidShift || (val.isOvertid ? val.shift : null);
        if (otShift) {
          const dateObj = parseISO(dateStr);
          items.push({
            dateStr,
            dateObj,
            shift: otShift,
            comment: comments?.[key] || "",
          });
        }
      }
    });

    return items.sort((a, b) => a.dateObj - b.dateObj);
  }, [overrides, comments, shiftGroup, selectedYear]);

  // Finn alle feriedager og grupper sammenhengende perioder for valgt år
  const { feriePeriods, totalFerieDays } = useMemo(() => {
    if (!overrides) return { feriePeriods: [], totalFerieDays: 0 };
    const dateList = [];

    Object.entries(overrides).forEach(([key, val]) => {
      const firstDash = key.indexOf("-");
      if (firstDash === -1) return;
      const grp = Number(key.slice(0, firstDash));
      const dateStr = key.slice(firstDash + 1);

      if (grp === shiftGroup && dateStr.startsWith(`${selectedYear}-`) && val.isFerie) {
        dateList.push({
          dateStr,
          dateObj: parseISO(dateStr),
          comment: comments?.[key] || "",
        });
      }
    });

    dateList.sort((a, b) => a.dateObj - b.dateObj);

    // Grupper sammenhengende feriedager til perioder
    const periods = [];
    let currentPeriod = null;

    for (let i = 0; i < dateList.length; i++) {
      const item = dateList[i];
      if (!currentPeriod) {
        currentPeriod = {
          start: item.dateObj,
          end: item.dateObj,
          startDateStr: item.dateStr,
          comments: item.comment ? [item.comment] : [],
        };
      } else {
        const diff = differenceInCalendarDays(item.dateObj, currentPeriod.end);
        if (diff === 1) {
          currentPeriod.end = item.dateObj;
          if (item.comment) currentPeriod.comments.push(item.comment);
        } else {
          periods.push(currentPeriod);
          currentPeriod = {
            start: item.dateObj,
            end: item.dateObj,
            startDateStr: item.dateStr,
            comments: item.comment ? [item.comment] : [],
          };
        }
      }
    }

    if (currentPeriod) {
      periods.push(currentPeriod);
    }

    return {
      feriePeriods: periods,
      totalFerieDays: dateList.length,
    };
  }, [overrides, comments, shiftGroup, selectedYear]);

  // Fordeling av overtidsskift
  const overtidCounts = useMemo(() => {
    const counts = {};
    overtidItems.forEach((it) => {
      counts[it.shift] = (counts[it.shift] || 0) + 1;
    });
    return counts;
  }, [overtidItems]);

  const handleItemPress = (dateObj) => {
    if (onSelectDate) {
      onSelectDate(dateObj);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.cardBg }]}>
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
              📋 Årsoversikt (Skift {shiftGroup})
            </Text>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: theme.inactiveButtonBg }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.closeBtnText, { color: theme.textPrimary }]}>Lukk</Text>
            </TouchableOpacity>
          </View>

          {/* Årsvelger */}
          <View style={[styles.yearSelectorCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <TouchableOpacity
              style={[styles.yearNavBtn, { backgroundColor: theme.navButtonBg }]}
              onPress={() => setSelectedYear((prev) => prev - 1)}
              activeOpacity={0.6}
            >
              <Text style={[styles.yearNavText, { color: theme.navButtonText }]}>‹</Text>
            </TouchableOpacity>

            <View style={styles.yearTitleBox}>
              <Text style={[styles.yearTitleText, { color: theme.textPrimary }]}>{selectedYear}</Text>
              <Text style={[styles.yearSubText, { color: theme.textMuted }]}>
                {activeTab === "overtid"
                  ? `${overtidItems.length} overtidsskift registrert`
                  : `${totalFerieDays} feriedagar registrert`}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.yearNavBtn, { backgroundColor: theme.navButtonBg }]}
              onPress={() => setSelectedYear((prev) => prev + 1)}
              activeOpacity={0.6}
            >
              <Text style={[styles.yearNavText, { color: theme.navButtonText }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Fane-veksler */}
          <View style={styles.tabsWrapper}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                { backgroundColor: theme.inactiveButtonBg },
                activeTab === "overtid" && { backgroundColor: theme.overtidBadgeBg },
              ]}
              onPress={() => setActiveTab("overtid")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === "overtid" ? "#ffffff" : theme.textSecondary },
                ]}
              >
                ⚡ Overtid ({overtidItems.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                { backgroundColor: theme.inactiveButtonBg },
                activeTab === "ferie" && { backgroundColor: theme.ferieBadgeBg },
              ]}
              onPress={() => setActiveTab("ferie")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === "ferie" ? "#ffffff" : theme.textSecondary },
                ]}
              >
                🏖️ Ferie ({totalFerieDays} d)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Innhold */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. OVERTIDS-FANE */}
            {activeTab === "overtid" && (
              <>
                {/* Oppsummering */}
                {overtidItems.length > 0 && (
                  <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.summaryTitle, { color: theme.textSecondary }]}>
                      Overtidsfordeling i {selectedYear}:
                    </Text>
                    <View style={styles.summaryChipsRow}>
                      {Object.entries(overtidCounts).map(([sKey, cnt]) => {
                        const sc = getShiftColor(sKey, isDark);
                        return (
                          <View
                            key={sKey}
                            style={[
                              styles.summaryChip,
                              { backgroundColor: sc.bg, borderColor: sc.border },
                            ]}
                          >
                            <Text style={[styles.summaryChipText, { color: sc.text }]}>
                              {cnt}x {sKey}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Tom tilstand */}
                {overtidItems.length === 0 && (
                  <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    <Text style={styles.emptyIcon}>⚡</Text>
                    <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                      Ingen overtidsskift i {selectedYear}
                    </Text>
                    <Text style={[styles.emptyDesc, { color: theme.textMuted }]}>
                      Trykk på ein dag i kalenderen og vel overtid for å registrere ekstravakter.
                    </Text>
                  </View>
                )}

                {/* Liste over overtidsskift */}
                {overtidItems.map((it, idx) => {
                  const sc = getShiftColor(it.shift, isDark);
                  const time = shiftTimes?.[it.shift] || "";

                  return (
                    <TouchableOpacity
                      key={it.dateStr}
                      style={[
                        styles.listItemCard,
                        { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                      ]}
                      onPress={() => handleItemPress(it.dateObj)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.listItemLeft}>
                        <View style={[styles.itemNumberBadge, { backgroundColor: theme.inactiveButtonBg }]}>
                          <Text style={[styles.itemNumberText, { color: theme.textMuted }]}>
                            {idx + 1}
                          </Text>
                        </View>
                        <View>
                          <Text style={[styles.itemDateText, { color: theme.textPrimary }]}>
                            {format(it.dateObj, "EEEE d. MMMM", { locale: nb })}
                          </Text>
                          {time ? (
                            <Text style={[styles.itemTimeText, { color: theme.textMuted }]}>
                              ⏰ {time}
                            </Text>
                          ) : null}
                          {it.comment ? (
                            <Text style={[styles.itemCommentText, { color: theme.textSecondary }]}>
                              📝 {it.comment}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={[styles.shiftBadgePill, { backgroundColor: sc.bg, borderColor: sc.border }]}>
                        <Text style={[styles.shiftBadgePillText, { color: sc.text }]}>
                          ⚡ {it.shift}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* 2. FERIE-FANE */}
            {activeTab === "ferie" && (
              <>
                {/* Oppsummering */}
                {totalFerieDays > 0 && (
                  <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.summaryTitle, { color: theme.textSecondary }]}>
                      Feriestatistikk {selectedYear}:
                    </Text>
                    <Text style={[styles.summaryLargeStat, { color: theme.ferieBadgeBg }]}>
                      {totalFerieDays} feriedagar registrert
                    </Text>
                    <Text style={[styles.summarySubStat, { color: theme.textMuted }]}>
                      Fordelt over {feriePeriods.length} {feriePeriods.length === 1 ? "periode" : "periodar"}.
                    </Text>
                  </View>
                )}

                {/* Tom tilstand */}
                {feriePeriods.length === 0 && (
                  <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    <Text style={styles.emptyIcon}>🏖️</Text>
                    <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                      Ingen feriedagar i {selectedYear}
                    </Text>
                    <Text style={[styles.emptyDesc, { color: theme.textMuted }]}>
                      Bruk «🏖️ Ferie»-knappen øvst for å leggje inn ferieperiodar eller enkeltdagar.
                    </Text>
                  </View>
                )}

                {/* Liste over ferieperioder */}
                {feriePeriods.map((p, idx) => {
                  const daysInPeriod = differenceInCalendarDays(p.end, p.start) + 1;
                  const isSingleDay = daysInPeriod === 1;

                  return (
                    <TouchableOpacity
                      key={p.startDateStr}
                      style={[
                        styles.listItemCard,
                        { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                      ]}
                      onPress={() => handleItemPress(p.start)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.listItemLeft}>
                        <View style={[styles.itemNumberBadge, { backgroundColor: theme.inactiveButtonBg }]}>
                          <Text style={[styles.itemNumberText, { color: theme.textMuted }]}>
                            {idx + 1}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          {isSingleDay ? (
                            <Text style={[styles.itemDateText, { color: theme.textPrimary }]}>
                              {format(p.start, "EEEE d. MMMM yyyy", { locale: nb })}
                            </Text>
                          ) : (
                            <>
                              <Text style={[styles.itemDateText, { color: theme.textPrimary }]}>
                                {format(p.start, "d. MMM", { locale: nb })} –{" "}
                                {format(p.end, "d. MMM yyyy", { locale: nb })}
                              </Text>
                              <Text style={[styles.periodDurationText, { color: theme.textMuted }]}>
                                {daysInPeriod} samanhengande dagar
                              </Text>
                            </>
                          )}

                          {p.comments.length > 0 && (
                            <Text style={[styles.itemCommentText, { color: theme.textSecondary }]}>
                              📝 {p.comments[0]}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View
                        style={[
                          styles.ferieBadgePill,
                          { backgroundColor: theme.ferieBadgeBg },
                        ]}
                      >
                        <Text style={styles.ferieBadgePillText}>
                          🏖️ {daysInPeriod} {daysInPeriod === 1 ? "dag" : "dagar"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "bold",
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  yearSelectorCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  yearNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  yearNavText: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: -2,
  },
  yearTitleBox: {
    alignItems: "center",
  },
  yearTitleText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  yearSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  tabsWrapper: {
    flexDirection: "row",
    marginHorizontal: 12,
    gap: 8,
    marginBottom: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 30,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  summaryChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  summaryChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  summaryLargeStat: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  summarySubStat: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyCard: {
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  listItemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  itemNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  itemNumberText: {
    fontSize: 11,
    fontWeight: "700",
  },
  itemDateText: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  itemTimeText: {
    fontSize: 11,
    marginTop: 2,
  },
  itemCommentText: {
    fontSize: 11,
    marginTop: 3,
  },
  periodDurationText: {
    fontSize: 11,
    marginTop: 1,
  },
  shiftBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },
  shiftBadgePillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  ferieBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 8,
  },
  ferieBadgePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
});

export default YearOverviewModal;
