import React, { useEffect, useState, useContext } from "react";
import { MessageProvider, MessageContext } from "../hooks/MessageProvider";
import { motion } from "framer-motion";
import icon_warning from "../assets/icons/warning.png";
import icon_critical from "../assets/icons/critical.png";
import icon_ok from "../assets/icons/check.png";

function OutcomeStatus(props) {
  const [icon, setIcon] = useState(icon_warning);
  const { setMessage } = useContext(MessageContext);
  const [shakiness, setShakiness] = useState(2);

  useEffect(() => {
    if (props.outcome) {
      switch (props.outcome.icon) {
        case "critical":
          setIcon(icon_critical);
          setShakiness(2);
          break;
        case "warning":
          setIcon(icon_warning);
          setShakiness(2);
          break;
        case "ok":
          setIcon(icon_ok);
          setShakiness(0);
          break;
        default:
          setIcon();
          break;
      }
    }
  }, [props.outcome]);

  function click_help_needed() {
    // Fire this message off to the context system. Listeners will pick it up.
    // In this case, this is usually the Detailed Help control
    setShakiness(0);
    setMessage({ ...props.outcome });
  }

  return (
    <motion.div
      className="flex flex-shrink-0"
      animate={{
        x: [0, -shakiness, shakiness, -shakiness, shakiness, 0],
        transition: {
          delay: 1,
          duration: 0.5,
          repeat: Infinity,
          repeatDelay: 1,
        },
      }}
    >
      <img
        src={icon}
        className="w-8 h-8 cursor-pointer"
        title={props?.outcome?.tooltip}
        onClick={() => click_help_needed()}
      />
    </motion.div>
  );
}

export default OutcomeStatus;
