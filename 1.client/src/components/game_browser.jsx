import React, { useContext, useEffect, useState } from "react";
import { motion } from "framer-motion";

function GameBrowser() {
  
  const variants = {
    open: { opacity: 1, height: "20rem" },
    closed: { opacity: 0.5, height: "4em" },
  };

  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      className="flex w-full bg-base-200 shadow-md rounded-xl p-4"
      animate={isOpen ? "open" : "closed"}
      variants={variants}
    >
      <div className="flex flex-row w-full justify-between">
        <p className="text-xl">Game Browser</p>
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
      </div>
    </motion.div>
  );
}

export default GameBrowser;
