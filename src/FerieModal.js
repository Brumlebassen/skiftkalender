import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { format, addDays } from "date-fns";
import { nb } from "date-fns/locale";

const FerieModal = ({ visible, onClose, onSaveFeriePeriod, onRemoveFeriePeriod, theme }) => {
  const today = new Date();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 6)); // Standard 1 uke

  const adjustStartDate = (days) => {
    const next = addDays(startDate, days);
    setStartDate(next);
    if (next > endDate) {
      setEndDate(next);
    }
  };

  const adjustEndDate = (days) => {
    const next = addDays(endDate, days);
    if (next >= startDate) {
      setEndDate(next);
    }
  };

  const setQuickPeriod = (weeks) => {
    setEndDate(addDays(startDate, weeks * 7 - 1));
  };

  const handleSave = () => {
    onSaveFeriePeriod(startDate, endDate);
    onClose();
  };

  const handleRemove = () => {
    onRemoveFeriePeriod(startDate, endDate);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.overlay, { backgroundColor: theme.modalOverlay }]}
      >
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              🏖️ Legg inn ferieperiode
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.closeIcon, { color: theme.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Vel start- og sluttdato for ferien. Alle dagar i perioden vert merkte som ferie.
          </Text>

          {/* Frå dato */}
          <View style={[styles.datePickerBox, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
            <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>Frå og med:</Text>
            <View style={styles.dateControlRow}>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.inactiveButtonBg }]}
                onPress={() => adjustStartDate(-1)}
              >
                <Text style={[styles.stepBtnText, { color: theme.textPrimary }]}>-1 d</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.inactiveButtonBg }]}
                onPress={() => adjustStartDate(-7)}
              >
                <Text style={[styles.stepBtnText, { color: theme.textPrimary }]}>-1 v</Text>
              </TouchableOpacity>

              <Text style={[styles.dateValueText, { color: theme.textPrimary }]}>
                {format(startDate, "EEE d. MMM yyyy", { locale: nb })}
              </Text>

              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.inactiveButtonBg }]}
                onPress={() => adjustStartDate(1)}
              >
                <Text style={[styles.stepBtnText, { color: theme.textPrimary }]}>+1 d</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.inactiveButtonBg }]}
                onPress={() => adjustStartDate(7)}
              >
                <Text style={[styles.stepBtnText, { color: theme.textPrimary }]}>+1 v</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Til dato */}
          <View style={[styles.datePickerBox, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
            <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>Til og med:</Text>
            <View style={styles.dateControlRow}>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.inactiveButtonBg }]}
                onPress={() => adjustEndDate(-1)}
              >
                <Text style={[styles.stepBtnText, { color: theme.textPrimary }]}>-1 d</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.inactiveButtonBg }]}
                onPress={() => adjustEndDate(-7)}
              >
                <Text style={[styles.stepBtnText, { color: theme.textPrimary }]}>-1 v</Text>
              </TouchableOpacity>

              <Text style={[styles.dateValueText, { color: theme.textPrimary }]}>
                {format(endDate, "EEE d. MMM yyyy", { locale: nb })}
              </Text>

              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.inactiveButtonBg }]}
                onPress={() => adjustEndDate(1)}
              >
                <Text style={[styles.stepBtnText, { color: theme.textPrimary }]}>+1 d</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.inactiveButtonBg }]}
                onPress={() => adjustEndDate(7)}
              >
                <Text style={[styles.stepBtnText, { color: theme.textPrimary }]}>+1 v</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hurtigvalg for lengde */}
          <Text style={[styles.quickLabel, { color: theme.textSecondary }]}>Hurtigvalg lengde:</Text>
          <View style={styles.quickButtonGroup}>
            {[1, 2, 3, 4].map((w) => (
              <TouchableOpacity
                key={w}
                style={[styles.quickBtn, { backgroundColor: theme.inactiveButtonBg }]}
                onPress={() => setQuickPeriod(w)}
              >
                <Text style={[styles.quickBtnText, { color: theme.textPrimary }]}>
                  {w} {w === 1 ? "veke" : "veker"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Knapper */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.removeButton, { borderColor: theme.cardBorder }]}
              onPress={handleRemove}
              activeOpacity={0.7}
            >
              <Text style={styles.removeButtonText}>Fjern ferie i periode</Text>
            </TouchableOpacity>

            <View style={styles.rightButtons}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: theme.inactiveButtonBg }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelBtnText, { color: theme.inactiveButtonText }]}>
                  Avbryt
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.ferieBadgeBg }]}
                onPress={handleSave}
              >
                <Text style={styles.saveBtnText}>Legg til ferie</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: "bold",
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: "bold",
    padding: 4,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 16,
  },
  datePickerBox: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  dateControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  stepBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dateValueText: {
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
    flex: 1,
    textTransform: "capitalize",
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 4,
  },
  quickButtonGroup: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 18,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: "center",
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  removeButton: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  removeButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ef4444",
  },
  rightButtons: {
    flexDirection: "row",
    gap: 8,
    marginLeft: "auto",
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});

export default FerieModal;
