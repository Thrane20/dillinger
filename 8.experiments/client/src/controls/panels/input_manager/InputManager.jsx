import React, { useEffect, useState } from "react";
import { useLogs } from "../../../hooks/useLogs";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";
import AnimatedText from "../../base_controls/AnimatedText";

function InputManager() {

    const { logs } = useLogs();

    const [gamepads, setGamepads] = useState([]);
    const [keyboards, setKeyboards] = useState([]);

    useEffect(() => {
        const updateGamepads = () => {
            console.log("Updating gamepads");
            const connectedGamepads = navigator.getGamepads ? [...navigator.getGamepads()].filter(gp => gp) : [];
            setGamepads(connectedGamepads);
        };

        const updateKeyboards = async () => {
            if (navigator.keyboard) {
                setKeyboards([..."Keyboard"]);
            }
        };

        window.addEventListener("gamepadconnected", updateGamepads);
        window.addEventListener("gamepaddisconnected", updateGamepads);

        updateGamepads();
        updateKeyboards();

        return () => {
            window.removeEventListener("gamepadconnected", updateGamepads);
            window.removeEventListener("gamepaddisconnected", updateGamepads);
        };
    }, [logs]);

    useEffect(() => {
    }, [logs]);

    return (
        <CanvasBackground>
            <div className="flex flex-col gap-2">
                <p className="text-base line-above-below">Input Manager</p>
                <div>
                    <h3>Connected Gamepads:</h3>
                    <ul>
                        {gamepads.map((gamepad, index) => (
                            <li key={index}>{gamepad.id}</li>
                        ))}
                    </ul>
                </div>
            </div>
            <div>
                <h3>Connected Keyboards:</h3>
                <ul>
                    {keyboards}
                </ul>
            </div>

        </CanvasBackground >
    );
}

export default InputManager;