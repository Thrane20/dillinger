import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import refresh_icon from "../assets/icons/refresh.svg";

function RefreshButton( { buttonClicked }) {
  
  const [isRotated, setIsRotated] = useState(false);
  const [rotationKey, setRotationKey] = useState(0);


  // Call the server to audit our game files and refresh the cache
  function onClick() {
    setIsRotated(true);

    // Call the parent function if it exists
    buttonClicked && buttonClicked();
    
    // Reset the rotation state after it's presumably done
    const timeout = setTimeout(() => {
      setIsRotated(false);
      // Increment the key to force re-render
      setRotationKey(prevKey => prevKey + 1);
    }, 1000); // Adjust the duration according to your animation
    return () => clearTimeout(timeout);
  }

  return (
    <motion.div
       className="flex items-center justify-center cursor-pointer w-6 h-6"
        key={rotationKey}
        initial={{ rotate: 0 }}
        animate={{ rotate: isRotated ? 720 : 0 }}
        transition={{ duration: 1.0 }}
        style={{ transformOrigin: "center" }}
      >
        <img
          className="flex w-6 h-6  gray-filter"
          src={refresh_icon}
          onClick={onClick}
        />
      </motion.div>
  );
}

export default RefreshButton;
