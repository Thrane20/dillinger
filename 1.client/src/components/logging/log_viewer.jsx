import React, { useEffect, useState, useContext, useRef } from "react";
import { motion } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import { FixedSizeList as List } from "react-window";
import { LogContext } from "../../hooks/LogProvider";

function LogViewer(props) {
  // Get a handle to the LogContext
  const { allLogs, clearLogs } = useContext(LogContext);
  const { allWineLogs, clearWineLogs } = useContext(LogContext);

  const listRef = useRef();
  const listWineRef = useRef();

  const variants = {
    open: { opacity: 1, height: "28rem" },
    closed: { opacity: 1, height: "10em" },
  };

  const scrollHeightVariants = {
    open: { height: "25rem" },
    closed: { height: "5em" },
  };

  const [isOpen, setIsOpen] = useState(false);

  // Scroll to the last item when logs update
  useEffect(() => {
    if (listRef.current) {
      const { scrollHeight, clientHeight } = listRef.current;
      const scrollPosition = scrollHeight - clientHeight;
      listRef.current.scrollTo(0, scrollPosition);
    }
  }, [allLogs]);

  // Scroll to the last item when logs update
  useEffect(() => {
    if (listWineRef.current) {
      const { scrollHeight, clientHeight } = listWineRef.current;
      const scrollPosition = scrollHeight - clientHeight;
      listWineRef.current.scrollTo(0, scrollPosition);
    }
  }, [allWineLogs]);

  return (
    <motion.div
      layout
      className="flex flex-col w-full h-48 bg-base-300 shadow-md rounded-xl p-4"
      animate={isOpen ? "open" : "closed"}
      variants={variants}
    >
      <div className="flex flex-row justify-between">
        <div role="tablist" className="tabs tabs-bordered w-full pb-6">
          <input
            type="radio"
            name="my_tabs_1"
            role="tab"
            className="tab"
            aria-label="Dillinger Logs"
          />
          <motion.div
            layout
            ref={listRef}
            variants={scrollHeightVariants}
            role="tabpanel"
            width="100%"
            className="tab-content p-5 overflow-auto mt-4"
          >
            {allLogs.map((log, index) => (
              <div key={index} className="text-md text-left text-white">
                <p>{log.time + " -- " + log.message}</p>
              </div>
            ))}
          </motion.div>

          <input
            type="radio"
            name="my_tabs_1"
            role="tab"
            className="tab"
            aria-label="Wine Logs"
            defaultChecked
          />
          <motion.div
            layout
            ref={listWineRef}
            variants={scrollHeightVariants}
            role="tabpanel"
            width="100%"
            className="tab-content p-5 overflow-auto"
          >
            {allWineLogs.map((log, index) => (
              <div key={index} className="text-md text-left text-white">
                <p>{log.time + " -- " + log.message}</p>
              </div>
            ))}
          </motion.div>
        </div>
        <div className="divider divider-horizontal h-full"></div>
        <div className="flex flex-col gap-2">
          <button className="btn" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            )}
          </button>
          <button className="btn" onClick={() => clearLogs()}>
            [C]
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default LogViewer;
