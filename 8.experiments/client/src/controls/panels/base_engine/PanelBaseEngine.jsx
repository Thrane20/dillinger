import React, { useEffect, useState } from "react";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";
import SvgPlug from "./SvgPlug";
import SvgDocker from "./SvgDocker";

function PanelBaseEngine() {

    const [uptime, setUpTime] = useState("00:00:00");
    const [serverStatus, setServerStatus] = useState("down");
    const [dockerStatus, setDockerStatus] = useState("up");

    function classForServerStatus() {
        return serverStatus === "up" ? "color-ok" : "color-error";
    }

    function classForDockerStatus() {
        return dockerStatus === "up" ? "color-ok" : "color-error";
    }

    useEffect(() => {
        setInterval(() => {
            const date = new Date();
            const hours = date.getHours();
            const minutes = date.getMinutes();
            const seconds = date.getSeconds();
            const hoursStr = hours < 10 ? `0${hours}` : hours;
            const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
            const secondsStr = seconds < 10 ? `0${seconds}` : seconds;
            setUpTime(`${hoursStr}:${minutesStr}:${secondsStr}`);
        }, 1000);
    }, []);

    return (
        <CanvasBackground>
            <div className="flex flex-row w-full h-1/4 gap-2">
                <p className="flex text-2xl w-1/2 h-full items-center justify-center line-above-below">Dillinger</p>
                <div className="flex flex-col w-1/2 h-full">
                    <p className="flex w-full h-full items-center justify-center text-base line-above-below">LOCAL TIME</p>
                    <p className="flex w-full h-full items-center justify-center text-base line-above-below">{uptime}</p>
                </div>
            </div>
            <div className="flex flex-row w-full h-3/4 gap-2 mt-4">
                <ul className="vertical-line-list w-full text-start">
                    <li>
                        <div className="flex flex-row w-full justify-center items-center gap-1">
                            <SvgPlug className={`flex-shrink-0 ${classForServerStatus()} icon-xs`} size="icon-base" />
                            <div className="flex flex-grow line-horizontal"></div>
                            <p className="flex flex-shrink-0 w-auto h-full items-center justify-end text-base">Server Connection</p>
                        </div>
                    </li>
                    <li>
                        <div className="flex flex-row w-full justify-center items-center gap-1">
                            <SvgDocker className={`flex-shrink-0 ${classForDockerStatus()} icon-xs`} size="icon-base"  />
                            <div className="flex flex-grow line-horizontal"></div>
                            <p className="flex flex-shrink-0 w-auto h-full items-center justify-end text-base">Docker Status</p>
                        </div>
                    </li>
                </ul>
            </div>

        </CanvasBackground>
    );
}

export default PanelBaseEngine;