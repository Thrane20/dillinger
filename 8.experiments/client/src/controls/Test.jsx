import React, { useEffect } from "react";
import CanvasBackground from "./base_controls/canvas_background/CanvasBackground";

function Test() {

    return (
        <CanvasBackground>
            <p className="text-base line-above-below">Dillinger</p>
            <ul className="vertical-line-list text-start">
                <li>Item 1</li>
                <li>Item 2</li>
                <li>Item 3</li>
            </ul>
        </CanvasBackground>
    );
}

export default Test;