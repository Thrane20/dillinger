import React, { useEffect, useState, useContext } from "react";
import { MessageContext } from "../hooks/MessageProvider";
import { motion } from "framer-motion";
import icon_warning from "../assets/icons/warning.png";
import icon_critical from "../assets/icons/critical.png";

function OutcomeDetails(props) {
  const variants = {
    open: { opacity: 1, height: "20rem" },
    closed: { opacity: 0.5, height: "4em" },
  };

  const [icon, setIcon] = useState();
  const [isOpen, setIsOpen] = useState(false);
  const [outcome, setOutcome] = useState();
  const { message } = useContext(MessageContext);

  useEffect(() => {
    if (message) {
      setOutcome(message);
      setIsOpen(true);
    }
  }, [message]);

  useEffect(() => {
    if (props.outcome) {
      switch (props.outcome.icon) {
        case "critical":
          setIcon(icon_critical);
          break;
        case "warning":
          setIcon(icon_warning);
          break;
        default:
          setIcon();
          break;
      }
    }
  }, [props.outcome]);

  return (
    <motion.div
      layout
      className="flex flex-col w-full bg-base-300 shadow-md rounded-xl p-4 "
      animate={isOpen ? "open" : "closed"}
      variants={variants}
    >
      <div className="flex flex-row w-full justify-between">
        <p className="text-xl">Detailed Help</p>

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
      <motion.div
        layout
        className="flex flex-col w-full justify-between items-center p-2 gap-4 overflow-auto"
      >
        {isOpen ? (
          <>
            <p className="text-xl">{outcome?.title}</p>
            <p className="text-md">
              <strong>What this means:</strong> {outcome?.what}
            </p>
            <hr className="border-t border-base w-3/4 opacity-50" />
            <div className="flex flex-col w-full justify-start items-start gap-2">
              {outcome?.fixes?.map((fix, index) => (
                <p key={index} className="text-md">
                  <strong>Fix {index + 1}:</strong> {fix}
                </p>
              ))}
            </div>
          </>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

export default OutcomeDetails;
