import { motion } from "framer-motion";
import OutcomeDetails from "../components/outcome_details";


function SectionRight() {
  return (
    <motion.div
      layout
      className="flex flex-col w-full items-start justify-center gap-4"
    >
      <OutcomeDetails />
      
    </motion.div>
  );
}

export default SectionRight;
