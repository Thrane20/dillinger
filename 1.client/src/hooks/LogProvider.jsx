import React, { useState, createContext } from "react";
import createLog from "../components/logging/dillinger_log";

// Create a Context
export const LogContext = createContext();

// Create a Provider component
export function LogProvider({ children }) {
  
  const firstMessage = createLog("You shouldn't have come back, Flynn...");
  const firstMessageWine = createLog("Wow... such empty.");

  const [allLogs, setAllLogs] = useState([firstMessage]);
  const [allWineLogs, setAllWineLogs] = useState([firstMessageWine]);

  // Dillinger logs
  function appendLog(item) {
    setAllLogs((prev) => [...prev, item]);
  }

  function clearLogs() {
    let logClearedMessage = {
      time: new Date().toLocaleTimeString(),
      message: "Logs cleared",
    };
    setAllLogs([logClearedMessage]);
  }

  // Wine logs
  function appendWineLog(item) {
    setAllWineLogs((prev) => [...prev, item]);
  }

  function clearWineLogs() {
    let logClearedMessage = {
      time: new Date().toLocaleTimeString(),
      message: "Wine logs cleared",
    };
    setAllWineLogs([logClearedMessage]);
  }

  return (
    <LogContext.Provider value={{ createLog, allLogs, appendLog, clearLogs, allWineLogs, appendWineLog, clearWineLogs }}>
      {children}
    </LogContext.Provider>
  );
}

export default LogProvider;
