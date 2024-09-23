import React, { useEffect, useState } from "react";
import { useLogs } from "../../../hooks/useLogs";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";
import AnimatedText from "../../base_controls/AnimatedText";

function Gamescope() {

    const { logs } = useLogs();

    useEffect(() => {
    }, [logs]);

    return (
        <CanvasBackground>
            <div className="flex flex-col gap-2">
                <p className="text-base line-above-below">Gamescope</p>
                <ul className="vertical-line-list text-start">
                    <li>Configure</li>
                    <li>New...</li>
                </ul>
            </div>

        </CanvasBackground >
    );
}

export default Gamescope;