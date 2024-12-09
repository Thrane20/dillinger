import React, { useEffect, useState } from "react";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";
import { useApp } from "../../../hooks/useApp";
import App from "../../../App";

function Hero() {

    const [title, setTitle] = useState("Hero");

    // A global holder of what the Hero control is
    const { currentHeroControl, heroTitle } = useApp();

    return (
        <div className="flex flex-col w-full h-full p-2">
            <p className="text-base line-above-below">{heroTitle}</p>
            {currentHeroControl}
        </div>
    );
}

export default Hero;