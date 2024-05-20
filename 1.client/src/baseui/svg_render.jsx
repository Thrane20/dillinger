import React from "react";

import SvgDocker from "../assets/images/docker_blue.svg?react";
import SvgWorms from "../assets/images/worms.svg?react";
import SvgGampePad from "../assets/images/gamepad.svg?react";

export const SvgNames = {
    DOCKER: "docker",
    WORMS: "worms",
    GAMEPAD: "gamepad"
};

export function SvgRender({name, style}) {
    return buildSvgComponent(name, style);
}

function buildSvgComponent(name, style) {
    if(style === undefined) style = {width:"4em"};
    switch (name) {
        case SvgNames.DOCKER:
            return <SvgDocker style={style} />;
        case SvgNames.WORMS:
            return <SvgWorms style={style} />;
        case SvgNames.GAMEPAD:
            return <SvgGampePad style={style} />;
        default:
            return <SvgDocker style={style} />;
    }
}