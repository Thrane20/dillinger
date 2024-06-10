import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

function Header() {
  return (
    <motion.div initial={{ x: -50 }} animate={{ x: 0 }}>
      <p className="text-5xl">Dillinger</p>
    </motion.div>
  );
}

export default Header;
