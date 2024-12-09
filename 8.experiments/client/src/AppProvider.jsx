import React, { useState, useEffect, useMemo, createContext } from "react";

// Create a Context
export const AppContext = createContext();

// Create a Provider component
export function AppProvider({ children }) {

  const [currentHeroControl, setCurrentHeroControl] = useState(<></>);
  const [heroTitle, setHeroTitle] = useState("");

  const setHeroAs = (control) => {
    console.log("setNewHeroAs: ", control);
    setCurrentHeroControl(control);
  };

  const value = useMemo(() => ({ currentHeroControl, heroTitle, setHeroTitle, setHeroAs }), [currentHeroControl]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export default AppProvider;