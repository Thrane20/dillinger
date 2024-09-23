import React, { useEffect, useState } from "react";
import { useLogs } from "../../../hooks/useLogs";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";
import AnimatedText from "../../base_controls/AnimatedText";

function ALVR() {

    const { logs } = useLogs();

    useEffect(() => {
    }, [logs]);

    return (
        <CanvasBackground>
            <div className="flex flex-col gap-2">
                <p className="text-base line-above-below">ALVR / SteamVR</p>
                <ul className="vertical-line-list text-start">
                    <li>New...</li>
                    <li>Cofigure</li>
                </ul>
            </div>

        </CanvasBackground >
    );
}

export default ALVR;