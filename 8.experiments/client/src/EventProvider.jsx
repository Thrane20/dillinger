import React, { useState, useEffect, useMemo, createContext } from "react";
import { useLogs } from "./hooks/useLogs";

// Create a Context
export const EventContext = createContext();

export const StatusItems = Object.freeze({
  WEB_SOCKET: {
    NAME: "WebSocket",
    STATUS: {
      CONNECTING: "CONNECTING",
      OPEN: "OPEN",
      CLOSING: "CLOSING",
      CLOSED: "CLOSED"
    }
  },
  DOCKER: {
    NAME: "Docker",
    STATUS: {
      UP: "UP",
      DOWN: "DOWN"
    }
  }
});

function CreateEvent(name, status) {
  return { "component": name, "status": status };
}

// Create a Provider component
export function EventProvider({ children }) {

  const { appendLog } = useLogs();
  const [event, setEvent] = useState("");

  // Connect the dillinger web socket
  useEffect(() => {
    let intervalId;

    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://dillingerserver:${import.meta.env.VITE_SERVER_PORT}/ws`);

      ws.onopen = () => {
        console.log("Connected to the WebSocket server");
        setEvent(CreateEvent(StatusItems.WEB_SOCKET.NAME, StatusItems.WEB_SOCKET.STATUS.OPEN));
        clearInterval(intervalId); // Clear the retry interval upon success

        appendLog("Connected to the WebSocket server");
      };

      ws.onerror = (error) => {
        // Update our global state - note that we're connected to the dillinger web socket
        // TODO
      };

      ws.onmessage = (e) => {
        setEvent(e.data);
        // let logItem = createLog("WebSocket message: " + e.data);
        // appendLog(logItem);

      };

      ws.onclose = (event) => {
        // setSocketConnected({ status: "Down", outcome: outcomes.ws_socket_disconnected });
        // setGlobalState((prev) => ({
        //   ...prev,
        //   socketConnected: { status: "Down" },
        // }));
        // TODO

      };
    };

    // Initial attempt to connect
    connectWebSocket();

    // Set up retry every 2 seconds if the initial attempt fails
    intervalId = setInterval(() => {
      console.log("Attempting to reconnect WebSocket...");
      connectWebSocket();
    }, 2000);

    // Cleanup function to clear the interval on component unmount or success
    return () => {
      clearInterval(intervalId);
    }
  }, []);

  const value = useMemo(() => ({ event, setEvent }), [event]);

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
}

export default EventProvider;