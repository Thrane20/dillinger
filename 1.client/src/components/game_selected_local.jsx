import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

function GameSelectedLocal() {
  return (
    <motion.div className="flex w-full bg-base-200 shadow-md rounded-xl p-4" initial={{ x: -50 }} animate={{ x: 0 }}>
      <p className="text-xl">Selected Game - Local</p>
    </motion.div>
  );
}

export default GameSelectedLocal;
