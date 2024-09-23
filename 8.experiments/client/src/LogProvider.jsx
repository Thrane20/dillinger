import React, { useState, useEffect, useMemo, createContext } from "react";

// Create a Context
export const LogContext = createContext();

// Create a Provider component
export function LogProvider({ children }) {
  
  const [logs, setLogs] = useState([]);

  const appendLog = (newLog) => {
    newLog = {
      time: new Date().toLocaleTimeString(),
      message: newLog
    }
    setLogs((prevLogs) => [...prevLogs, newLog]);
  };

  const value = useMemo(() => ({ logs, appendLog }), [logs]);

  return (
    <LogContext.Provider value={value}>
      {children}
    </LogContext.Provider>
  );
}

export default LogProvider;