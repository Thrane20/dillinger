import React, { useEffect, useState } from "react";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";
import AnimatedText from "../../base_controls/AnimatedText";

function OpenTrack() {

    return (
        <CanvasBackground>
            <div className="flex flex-col gap-2">
                <p className="text-base line-above-below">OpenTrack</p>
                <ul className="vertical-line-list text-start">
                    <li>New...</li>
                    <li>Configure</li>
                    <li>On Port 185</li>
                </ul>
            </div>

        </CanvasBackground >
    );
}

export default OpenTrack;