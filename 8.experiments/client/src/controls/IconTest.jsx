import React, { useEffect } from "react";
import CanvasBackground from "./base_controls/canvas_background/CanvasBackground";
import Plug from "./panels/base_engine/SvgPlug";

function IconTest() {

    return (
        <CanvasBackground>
            <p className="text-base line-above-below">Dillinger</p>
            <Plug className="color-error icon-sm" size="icon-base" />
        </CanvasBackground>
    );
}

export default IconTest;