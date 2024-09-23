import React, { useEffect, useState } from "react";
import { useLogs } from "../../../hooks/useLogs";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";
import AnimatedText from "../../base_controls/AnimatedText";

function Logging() {

    const { logs } = useLogs();

    useEffect(() => {

    }, [logs]);

    return (
        <CanvasBackground>
            <p className="text-base line-above-below">Logging</p>
            <div className="flex flex-row gap-4">
                <button className="btn">Dillinger</button>
                <button className="btn">Wine</button>
            </div>
            <div className="flex flex-col gap-4">
                {logs.map((log, index) => {
                    return (
                        <div key={index} className="flex flex-row gap-4">
                            <p>{log.time}</p>
                            <p>{log.message}</p>
                        </div>
                    );
                })}
            </div>

        </CanvasBackground >
    );
}

export default Logging;