import React, { useEffect, useState } from "react";
import image_amiga from "../../assets/images/amiga.jpg";
import image_amiga_backdrop from "../../assets/images/amiga_backdrop.webp";

function GameAmiga({ isSelected }) {
  return (
    <div
      className="flex flex-col w-full h-full p-0 relative"
      style={{ position: "relative", height: "100%", overflow: "hidden" }}
    >
      <img
        src={image_amiga}
        alt="Gaming PC"
        className="w-full h-24 object-none rounded-lg"
        style={{ filter: !isSelected ? "saturate(30%)" : "saturate(100%)" }}
      />
      <p className="absolute top-0 left-0 mt-2 text-white w-full text-center text-2xl">
        PC
      </p>
      <img
        className="flex w-full h-full"
        src={image_amiga_backdrop}
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

export default GameAmiga;
