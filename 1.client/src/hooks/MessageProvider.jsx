import React, { useState, createContext, useContext } from "react";

// Create a Context
export const MessageContext = createContext();

// Create a Provider component
export function MessageProvider({ children }) {
  const [message, setMessage] = useState("");

  return (
    <MessageContext.Provider value={{ message, setMessage }}>
      {children}
    </MessageContext.Provider>
  );
}

export default MessageProvider;
