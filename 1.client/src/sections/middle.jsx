import { motion } from "framer-motion";

import GameSelectedRemote from "../components/game_selected_remote";
import GameSelectedLocal from "../components/game_management/game_selected_local";
import GameBrowser from "../components/game_browser";
import GameSearchLocal from "../components/search/game_search_local_composite";
import GameSearchRemote from "../components/search/game_search_remote";
import LogViewer from "../components/logging/log_viewer";

function SectionMiddle() {

  return (
    <motion.div
      layout
      className="flex flex-col w-full h-full items-start justify-stretch gap-4"
    >
      <GameSearchLocal />
      <GameSearchRemote />
      <GameBrowser />
      <GameSelectedLocal />
      <GameSelectedRemote />
      <LogViewer />
    </motion.div>
  );
}

export default SectionMiddle;
