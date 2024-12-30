import React, { useEffect, useState } from "react";
import { useLogs } from "../../../hooks/useLogs";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";
import AnimatedText from "../../base_controls/AnimatedText";

function CollectionStats() {
  const { logs } = useLogs();

  useEffect(() => {
    
  }, []);

    return (
    <CanvasBackground>
      <div className="flex flex-col gap-2">
        <p className="text-base line-above-below">Collection Stats</p>
        <div>
          <h3>Total Games:</h3>
        </div>
      </div>
    </CanvasBackground>
  );
}

export default CollectionStats;
