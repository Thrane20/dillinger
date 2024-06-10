import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import interactor_base_engine from "../../interactors/interactor_base_engine";
import OutcomeStatus from "../outcome_status";

import icon_docker from "../../assets/icons/docker_blue.svg";

function EngineBase() {
  const [dockerRunning, setDockerRunning] = useState("Run State: Unknown");

  useEffect(() => {
    setInterval(() => {
      interactor_base_engine.getDockerStatus().then((response) => {
        setDockerRunning(response);
      });
    }, 2000);
  }, []);

  return (
    <motion.div
      layout
      className="flex flex-col w-full items-center justify-center rounded-xl bg-base-200 shadow-md gap-4"
    >
      <p className="text-xl">Base Engine</p>
      <div className="flex flex-row w-full justify-between items-center gap-4 p-2">
        <img src={icon_docker} alt="Docker" className="h-8 w-8" />
        <hr className="border-t border-base w-3/4 opacity-20" />
        {dockerRunning.status}
        <OutcomeStatus outcome={dockerRunning.outcome} />
      </div>
    </motion.div>
  );
}

export default EngineBase;
