export const getTheme = (isDark) => {
  if (isDark) {
    return {
      isDark: true,
      bg: "#0f172a",
      cardBg: "#1e293b",
      cardBorder: "#334155",
      textPrimary: "#f8fafc",
      textSecondary: "#94a3b8",
      textMuted: "#64748b",
      headerBg: "#1e293b",
      headerBorder: "#334155",
      navButtonBg: "#334155",
      navButtonText: "#f8fafc",
      activeButtonBg: "#3b82f6",
      activeButtonText: "#ffffff",
      inactiveButtonBg: "#334155",
      inactiveButtonText: "#cbd5e1",
      weekHeaderColor: "#94a3b8",
      weekEndColor: "#f87171",
      weekNumberBg: "#1e293b",
      weekNumberText: "#94a3b8",
      todayBorder: "#38bdf8",
      outsideCellBg: "#0f172a",
      outsideCellText: "#475569",
      inputBg: "#0f172a",
      inputBorder: "#334155",
      inputText: "#f8fafc",
      modalOverlay: "rgba(0, 0, 0, 0.7)",
      overtidBadgeBg: "#ea580c",
      overtidBadgeText: "#ffffff",
      bytteBadgeBg: "#7c3aed",
      bytteBadgeText: "#ffffff",
      ferieBadgeBg: "#06b6d4",
      ferieBadgeText: "#ffffff",
    };
  }

  return {
    isDark: false,
    bg: "#f8fafc",
    cardBg: "#ffffff",
    cardBorder: "#e2e8f0",
    textPrimary: "#0f172a",
    textSecondary: "#475569",
    textMuted: "#64748b",
    headerBg: "#ffffff",
    headerBorder: "#e2e8f0",
    navButtonBg: "#f1f5f9",
    navButtonText: "#1e293b",
    activeButtonBg: "#1e3a8a",
    activeButtonText: "#ffffff",
    inactiveButtonBg: "#f1f5f9",
    inactiveButtonText: "#334155",
    weekHeaderColor: "#64748b",
    weekEndColor: "#ef4444",
    weekNumberBg: "#f1f5f9",
    weekNumberText: "#64748b",
    todayBorder: "#0284c7",
    outsideCellBg: "#f8fafc",
    outsideCellText: "#94a3b8",
    inputBg: "#f8fafc",
    inputBorder: "#cbd5e1",
    inputText: "#0f172a",
    modalOverlay: "rgba(15, 23, 42, 0.5)",
    overtidBadgeBg: "#ea580c",
    overtidBadgeText: "#ffffff",
    bytteBadgeBg: "#7c3aed",
    bytteBadgeText: "#ffffff",
    ferieBadgeBg: "#0891b2",
    ferieBadgeText: "#ffffff",
  };
};

export const getShiftColor = (shift, isDark = false) => {
  if (shift === "Ferie") {
    if (isDark) {
      return { bg: "#155e75", text: "#a5f3fc", border: "#0891b2" };
    }
    return { bg: "#cffafe", text: "#0e7490", border: "#67e8f9" };
  }

  if (isDark) {
    switch (shift) {
      case "Fm":
        return { bg: "#14532d", text: "#86efac", border: "#166534" };
      case "Em":
        return { bg: "#713f12", text: "#fef08a", border: "#854d0e" };
      case "N":
        return { bg: "#0c4a6e", text: "#7dd3fc", border: "#0369a1" };
      case "12tFm":
        return { bg: "#15803d", text: "#ffffff", border: "#16a34a" };
      case "12tN":
        return { bg: "#1d4ed8", text: "#ffffff", border: "#2563eb" };
      case "Fri":
        return { bg: "#1e293b", text: "#94a3b8", border: "#334155" };
      default:
        return { bg: "#1e293b", text: "#cbd5e1", border: "#334155" };
    }
  }

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
