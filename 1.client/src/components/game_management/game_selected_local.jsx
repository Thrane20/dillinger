import React, { useEffect, useState, useContext } from "react";
import { motion } from "framer-motion";
import { GlobalStateContext } from "../../hooks/GlobalStateProvider";

import GamePC from "./game_pc";
import GameAmiga from "./game_amiga";
import GameArcade from "./game_arcade";

function GameSelectedLocal() {
  const { globalState } = useContext(GlobalStateContext);
  const [selectedId, setSelectedId] = useState(null);

  const accordionData = [
    { id: 1, control: GamePC },
    { id: 3, control: GameArcade },
    { id: 2, control: GameAmiga },
    { id: 4, control: GamePC },
    { id: 5, control: GamePC },
  ];

  useEffect(() => {
    console.log("GameSelectedLocal: ", globalState);
  }, [globalState.gameSelectedLocal]);

  const handleClick = (id) => {
    setSelectedId(selectedId === id ? null : id); // Toggle selected state
  };

  return (
    <motion.div
      className="flex flex-col w-full max-w-full h-96 bg-base-300 shadow-md rounded-xl p-4 gap-2"
      initial={{ x: -50 }}
      animate={{ x: 0 }}
    >
      <p className="text-xl">Selected Game - Local</p>
      <p>Name: {globalState.gameSelectedLocal.slug}</p>
      <div className="flex justify-between w-full h-full">
        {accordionData.map((item) => (
          <motion.div
            key={item.id}
            className="bg-base-200 h-full shadow-md rounded-xl p-0 cursor-pointer"
            onClick={() => handleClick(item.id)}
            animate={{
              width: selectedId === item.id ? "75%" : "12.5%",
            }}
            transition={{ duration: 0.5 }}
          >
            {React.createElement(item.control, {
              isSelected: selectedId === item.id,
            })}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default GameSelectedLocal;
