import React, { useState, useEffect, useContext } from "react";
import { GlobalStateContext } from "../../hooks/GlobalStateProvider";
import createLog from "../logging/dillinger_log";
import { LogContext } from "../../hooks/LogProvider";
import { motion } from "framer-motion";
import interactor_base_engine from "../../interactors/interactor_base_engine";
import outcomes from "../../interactors/interactor_outcomes";
import OutcomeStatus from "../outcome_status";

import icon_docker from "../../assets/icons/docker.svg";
import socket_icon from "../../assets/icons/socket.svg";

function EngineBase() {
  const [dockerRunning, setDockerRunning] = useState({ status: "Unknown" });
  const [socketConnected, setSocketConnected] = useState({ status: "Unknown" });
  const { globalState, setGlobalState } = useContext(GlobalStateContext);
  const { appendLog } = useContext(LogContext);

  // Connect the dillinger web socket
  useEffect(() => {
    let intervalId;

    const connectWebSocket = () => {
      const ws = new WebSocket("ws://localhost:3060/ws");

      ws.onopen = () => {
        console.log("Connected to the WebSocket server");
        clearInterval(intervalId); // Clear the retry interval upon success

        // Update our global state - note that we're connected to the dillinger web socket
        setSocketConnected({ status: "Up", outcome: outcomes.ws_socket_connected });
        setGlobalState((prev) => ({
          ...prev,
          socketConnected: { status: "Up" },
        }));

        // Log it
        let logItem = createLog("WebSocket connected - success");
        appendLog(logItem);

        const message = JSON.stringify({
          id: "12345",
          message: "Hello, Server!",
        });
        ws.send(message);
      };

      ws.onerror = (error) => {
        // Update our global state - note that we're connected to the dillinger web socket
        setSocketConnected({ status: "Down", outcome: { icon: "critical" } });
        setGlobalState((prev) => ({
          ...prev,
          socketConnected: { status: "Down" },
        }));
      };

      ws.onmessage = (e) => {
        console.log("Got a message", e);
        let logItem = createLog("WebSocket message: " + e.data);
        appendLog(logItem);

      };

      ws.onclose = (event) => {
        setSocketConnected({ status: "Down", outcome: outcomes.ws_socket_disconnected });
        setGlobalState((prev) => ({
          ...prev,
          socketConnected: { status: "Down" },
        }));
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
    return () => clearInterval(intervalId);
  }, []);

  // Check for a docker connection
  useEffect(() => {
    let intervalId;
    const checkDockerStatus = () => {
      intervalId = setInterval(() => {
        interactor_base_engine.getDockerStatus().then((response) => {
          if (response.status === "Up") {
            // We stop looking - we're up. After this, if docker goes down, we would
            // handle this via a websocket update, not a poll.
            clearInterval(intervalId);
            appendLog(createLog("Docker is up"));
          }
          // Update the UI with the response
          setDockerRunning(response);
        });
      }, 1000);
    };

    checkDockerStatus();
  }, []);

  return (
    <motion.div
      layout
      className="flex flex-col w-full items-center justify-center rounded-xl bg-base-300 shadow-md gap-4"
    >
      <p className="text-xl">Base Engine</p>
      <div className="flex flex-row w-full justify-between items-center gap-4 p-2">
        <div className="avatar">
          <div className="w-10 bg-neutral rounded-full items-end justify-end">
            <img
              src={socket_icon}
              alt="Socket"
              className="m-1 max-h-8 max-w-8 h-8 w-8"
            />
          </div>
        </div>
        <hr className="flex flex-shrink border-t border-base w-full opacity-20" />
        {socketConnected.status}
        <OutcomeStatus outcome={socketConnected?.outcome} />
      </div>
      <div className="flex flex-row w-full justify-between items-center gap-4 p-2">
        <div className="w-10 bg-neutral rounded-full items-end justify-end">
          <img
            src={icon_docker}
            alt="Docker"
            className="m-1 max-h-8 max-w-8 h-8 w-8"
          />
        </div>
        <hr className="flex flex-shrink border-t border-base w-full opacity-20" />
        {dockerRunning.status}
        <OutcomeStatus outcome={dockerRunning?.outcome} />
      </div>
    </motion.div>
  );
}

export default EngineBase;
