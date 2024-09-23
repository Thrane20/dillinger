import React, { useEffect, useState } from "react";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";
import AnimatedText from "../../base_controls/AnimatedText";

function Runners() {


    return (
        <CanvasBackground>
            <div className="flex flex-col gap-2">
                <p className="text-base line-above-below">Runners</p>
                <ul className="vertical-line-list text-start">
                    <li>Wine</li>
                    <li>Amiga</li>
                    <li>Arcade</li>
                </ul>
            </div>

        </CanvasBackground >
    );
}

export default Runners;