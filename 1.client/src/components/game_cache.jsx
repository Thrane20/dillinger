import React, { useEffect, useState, useContext } from "react";
import { motion } from "framer-motion";
import refresh_icon from "../assets/icons/refresh.svg";
import interactor_base_engine from "../interactors/interactor_base_engine";
import RefreshButton from "../widgets/refresh_button";
import GlobalStateProvider, {
  GlobalStateContext,
} from "../hooks/GlobalStateProvider";

function GameCache() {
  const [cacheStatus, setCacheStatus] = useState("Unknown");
  const [isAnimating, setIsAnimating] = useState(false);

  // Accessor to the Global State Object
  const { globalState, setGlobalState } = useContext(GlobalStateContext);

  useEffect(() => {
    // Trigger the animation by setting isAnimating to true
    setIsAnimating(true);
    // Reset the animation state after it's presumably done
    const timeout = setTimeout(() => setIsAnimating(false), 2000); // Adjust the duration according to your animation
    return () => clearTimeout(timeout);
  }, [cacheStatus]); // Dependency array, animation triggers on cacheStatus update

  // Call the server to audit our game files and refresh the cache
  function refresh_game_cache() {
    interactor_base_engine.refresh_game_cache().then((response) => {
      if (response.status === "ok") {
        setCacheStatus("Refreshed");
      } else {
        setCacheStatus("Error");
      }
    });
  }

  return (
    <div className="flex bg-base-200 items-center p-3 rounded-md gap-2">
      <p className="font-bold">Game Cache:</p>
      <motion.p
        animate={{
          opacity: isAnimating ? [1, 0, 1, 0, 1] : 1, // Blink 3 times
        }}
        transition={{
          duration: 2, // Total duration of the blink animation
        }}
      >
        {cacheStatus}
      </motion.p>
      <RefreshButton buttonClicked={refresh_game_cache} />
    </div>
  );
}

export default GameCache;
