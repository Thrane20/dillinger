import React, { useEffect, useState } from "react";
import image_arcade from "../../assets/images/arcade.jpg";
import image_pcs from "../../assets/images/pcs.jpg";

function GameArcade({ isSelected }) {
  return (
    <div
      className="flex flex-col w-full h-full p-0 relative"
      style={{ position: "relative", height: "100%", overflow: "hidden" }}
    >
      <img
        src={image_arcade}
        alt="Arcade"
        className="w-full h-24 object-none rounded-lg"
        style={{ filter: !isSelected ? "saturate(30%)" : "saturate(100%)" }}
      />
      <p className="absolute top-0 left-0 mt-2 text-white w-full text-center text-2xl">
        Arcade
      </p>
      <img
        className="flex w-full h-full"
        src={image_arcade}
        style={{
          position: "absolute",
          filter: "saturate(50%)",
          opacity: 0.08,
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          maxHeight: "100%",
          overflow: "hidden",
        }}
      />
    </div>
  );
}

export default GameArcade;
