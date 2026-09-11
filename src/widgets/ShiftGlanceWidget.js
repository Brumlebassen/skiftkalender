import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

/**
 * Hurtigblikk-widget for heimeskjermen på Android
 */
export function ShiftGlanceWidget({
  shiftGroup = 1,
  todayDateText = "I dag",
  todayShift = "Fri",
  todayTime = "",
  todayBadge = null, // 'ferie' | 'bytte' | 'overtid' | null
  todayColor = { bg: "#1e293b", text: "#94a3b8", border: "#334155" },
  upcoming = [], // [{ dayLabel: 'I morgon', shift: 'Fm', color: { bg, text } }, ...]
  isDark = true,
}) {
  const cardBg = isDark ? "#0f172a" : "#ffffff";
  const innerBg = isDark ? "#1e293b" : "#f8fafc";
  const borderColor = isDark ? "#334155" : "#e2e8f0";
  const textColor = isDark ? "#f8fafc" : "#0f172a";
  const textMuted = isDark ? "#94a3b8" : "#64748b";
  const accentColor = "#0284c7";

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: cardBg,
        borderRadius: 16,
        padding: 12,
        flexDirection: "column",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: borderColor,
      }}
    >
      {/* 1. HEADER */}
      <FlexWidget
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          width: "match_parent",
        }}
      >
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <TextWidget
            text={`SKIFT ${shiftGroup}`}
            style={{
              fontSize: 11,
              fontWeight: "bold",
              color: accentColor,
              marginRight: 6,
            }}
          />
          <TextWidget
            text={`• ${todayDateText}`}
            style={{
              fontSize: 11,
              color: textMuted,
            }}
          />
        </FlexWidget>

        {todayBadge === "ferie" && (
          <TextWidget
            text="🏖️ Ferie"
            style={{ fontSize: 10, fontWeight: "bold", color: "#06b6d4" }}
          />
        )}
        {todayBadge === "bytte" && (
          <TextWidget
            text="🔄 Bytte"
            style={{ fontSize: 10, fontWeight: "bold", color: "#a855f7" }}
          />
        )}
        {todayBadge === "overtid" && (
          <TextWidget
            text="⚡ Overtid"
            style={{ fontSize: 10, fontWeight: "bold", color: "#f97316" }}
          />
        )}
      </FlexWidget>

      {/* 2. HOVUDVAKT I DAG */}
      <FlexWidget
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: innerBg,
          borderRadius: 12,
          padding: 8,
          marginVertical: 4,
          borderWidth: 1,
          borderColor: borderColor,
        }}
      >
        {/* Vakt-merke */}
        <FlexWidget
          style={{
            backgroundColor: todayColor.bg,
            borderWidth: 1,
            borderColor: todayColor.border,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 4,
            justifyContent: "center",
            alignItems: "center",
            marginRight: 10,
          }}
        >
          <TextWidget
            text={todayShift}
            style={{
              fontSize: 16,
              fontWeight: "bold",
              color: todayColor.text,
            }}
          />
        </FlexWidget>

        {/* Info / Tid */}
        <FlexWidget style={{ flexDirection: "column", justifyContent: "center" }}>
          <TextWidget
            text={todayShift === "Fri" ? "Fridag" : todayShift === "Ferie" ? "Ferie" : "Arbeidsvakt"}
            style={{
              fontSize: 13,
              fontWeight: "bold",
              color: textColor,
            }}
          />
          {todayTime ? (
            <TextWidget
              text={todayTime}
              style={{
                fontSize: 11,
                color: textMuted,
                marginTop: 2,
              }}
            />
          ) : null}
        </FlexWidget>
      </FlexWidget>

      {/* 3. KOMMANDE VAKTER */}
      <FlexWidget
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          width: "match_parent",
        }}
      >
        {upcoming.slice(0, 3).map((item, idx) => (
          <FlexWidget
            key={idx}
            style={{
              flexDirection: "column",
              alignItems: "center",
              backgroundColor: innerBg,
              borderRadius: 8,
              paddingVertical: 3,
              paddingHorizontal: 6,
              borderWidth: 1,
              borderColor: borderColor,
            }}
          >
            <TextWidget
              text={item.dayLabel}
              style={{
                fontSize: 9,
                color: textMuted,
                marginBottom: 2,
              }}
            />
            <FlexWidget
              style={{
                backgroundColor: item.color.bg,
                borderRadius: 4,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}
            >
              <TextWidget
                text={item.shift}
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  color: item.color.text,
                }}
              />
            </FlexWidget>
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
