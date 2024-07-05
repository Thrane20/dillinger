import React, { useState, createContext } from "react";

// Create a Context
export const GlobalStateContext = createContext();

// Create a Provider component
export function GlobalStateProvider({ children }) {
  
  let state = {
    socketConnected: false,
    searchCacheStatus: {},
    gameSelectedLocal: {
      slug: "No game selected",
      title: "No game selected",
      platform: "No platform selected",
    }
  };

  const [globalState, setGlobalState] = useState(state);

  return (
    <GlobalStateContext.Provider value={{ globalState, setGlobalState }}>
      {children}
    </GlobalStateContext.Provider>
  );
}

export default GlobalStateProvider;
