import { motion } from "framer-motion";
import GameSearchBar from "../components/game_search_bar";
import { searchLocalEntries } from "../logics/game_search";
import GameSelectedLocal from "../components/game_selected_local";
import GameSelectedRemote from "../components/game_selected_remote";
import GameBrowser from "../components/game_browser";

function SectionMiddle() {
  return (
    <motion.div
      layout
      className="flex flex-col w-full items-start justify-center gap-4"
    >
      <GameSearchBar onSearchChanged={searchLocalEntries} />
      <GameBrowser />
      <GameSelectedLocal />
      <GameSelectedRemote />
    </motion.div>
  );
}

export default SectionMiddle;
