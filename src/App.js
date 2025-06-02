import React from 'react';
import Calendar from "./Calendar";

function App() {
  return (
    <div className="min-h-screen bg-white text-gray-800 p-4">
      <h1 className="text-2xl font-bold mb-6 text-center">Skiftkalender</h1>
      <Calendar />
    </div>
  );
}

export default App;