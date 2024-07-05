import { motion } from "framer-motion";
import EngineBase from "../components/engine/engine_base";
import GameCache from "../components/game_cache";

function SectionFooter() {
  return (
    <motion.div
      layout
      className="navbar flex-0 w-full h-16 rounded-xl bg-base-300 mb-4"
    >
      <div className="flex flex-row w-full justify-start items-center gap-4 p-1">
        <GameCache />
        <a className="btn btn-ghost text-xl">Footer</a>
      </div>
    </motion.div>
  );
}

export default SectionFooter;
