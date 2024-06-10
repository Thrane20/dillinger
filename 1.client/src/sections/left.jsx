import { motion } from "framer-motion";
import EngineBase from "../components/engine/engine_base";

function SectionLeft() {
  return (
    <motion.div layout className="flex w-full items-start justify-center rounded-xl bg-base-200 shadow-md">
      <EngineBase />
    </motion.div>
  );
}

export default SectionLeft;
