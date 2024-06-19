import { motion } from "framer-motion";
import GameSearchBar from "../components/game_search_bar";
import GameSelectedLocal from "../components/game_selected_local";
import GameSelectedRemote from "../components/game_selected_remote";
import GameBrowser from "../components/game_browser";
import GameSearchLocal from "../components/game_search_local_composite";

function SectionMiddle() {
  return (
    <motion.div
      layout
      className="flex flex-col w-full items-start justify-center gap-4"
    >
      <GameSearchLocal />
      {/* <GameSearchBar onSearchChanged={search.searchLocalEntries} /> */}
      <GameBrowser />
      <GameSelectedLocal />
      <GameSelectedRemote />
    </motion.div>
  );
}

export default SectionMiddle;
