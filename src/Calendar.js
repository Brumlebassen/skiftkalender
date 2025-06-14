import React, { useState, useEffect } from "react";
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  differenceInCalendarDays,
} from "date-fns";

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

const Calendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 5));
  const [shiftGroup, setShiftGroup] = useState(3);
  const [customShifts, setCustomShifts] = useState({});
  const [comments, setComments] = useState(() => {
    const saved = localStorage.getItem("shiftComments");
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedKey, setSelectedKey] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);

  const sanitize = (text) => text.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();

  useEffect(() => {
    localStorage.setItem("shiftComments", JSON.stringify(comments));
  }, [comments]);

  const handleShiftEdit = (dateStr) => {
    const key = `${shiftGroup}-${dateStr}`;
    setSelectedKey(key);
    setCommentText(comments[key] || '');
    setShowCommentBox(true);
  };

  const renderHeader = () => (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
      <div className="flex justify-between items-center">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>&lt;</button>
        <h2 className="text-xl font-bold mx-4">{format(currentMonth, "MMMM yyyy")}</h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>&gt;</button>
      </div>
    </div>
  );

  const renderShiftSelector = () => (
    <div className="mb-4">
      <label htmlFor="shiftGroup" className="mr-2 font-semibold">Velg skift:</label>
      <select
        id="shiftGroup"
        value={shiftGroup}
        onChange={(e) => setShiftGroup(Number(e.target.value))}
        className="border p-1 rounded"
      >
        {[1, 2, 3, 4, 5].map((num) => (
          <option key={num} value={num}>Skift {num}</option>
        ))}
      </select>
    </div>
  );

  const renderDays = () => (
    <div className="grid grid-cols-7 text-center font-bold mb-2 text-sm sm:text-base">
      {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => (
        <div key={day}>{day}</div>
      ))}
    </div>
  );

  const getShiftColor = (shift) => {
    switch (shift) {
      case "Fm": return "bg-green-200";
      case "Em": return "bg-yellow-200";
      case "N": return "bg-blue-200 text-white";
      case "12tFm": return "bg-green-400 text-white";
      case "12tN": return "bg-blue-400 text-white";
      case "Fri": return "bg-gray-200";
      default: return "bg-white";
    }
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = addDays(startDate, 41);
    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const dateStr = format(day, "yyyy-MM-dd");
        const key = `${shiftGroup}-${dateStr}`;
        const shift = isSameMonth(day, monthStart)
          ? (customShifts[dateStr] || getShiftForDate(day, shiftGroup))
          : "";
        days.push(
          <div
            key={dateStr}
            className={`border h-20 sm:h-24 p-1 sm:p-2 text-xs sm:text-base text-center cursor-pointer rounded-xl shadow-sm transition-transform duration-200 hover:scale-105 ${getShiftColor(shift)}`}
            onClick={() => isSameMonth(day, monthStart) && handleShiftEdit(dateStr)}
          >
            <div className="font-semibold">{format(day, "d")}</div>
            <div>{shift}</div>
            <div className="text-xs mt-1 text-gray-700 truncate">
              {comments[key] && `📝 ${comments[key].slice(0, 20)}`}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7 gap-1" key={day}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="space-y-1 sm:space-y-2">{rows}</div>;
  };

  return (
    <div className="p-2 sm:p-4 max-w-5xl mx-auto">
      {renderHeader()}
      {renderShiftSelector()}
      {renderDays()}
      {renderCells()}

      {showCommentBox && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[9999]">
          <div className="bg-white p-4 rounded-xl shadow-lg w-[90%] max-w-md">
            <h2 className="text-lg font-bold mb-2">Kommentar for {selectedKey}</h2>
            <textarea
              className="w-full h-24 p-2 border rounded"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Skriv kommentar her..."
            />
            <div className="flex justify-end mt-4 space-x-2">
              <button
                className="px-4 py-1 bg-gray-300 rounded hover:bg-gray-400"
                onClick={() => setShowCommentBox(false)}
              >
                Avbryt
              </button>
              <button
                className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={() => {
                  setComments({ ...comments, [selectedKey]: sanitize(commentText) });
                  setShowCommentBox(false);
                }}
              >
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
