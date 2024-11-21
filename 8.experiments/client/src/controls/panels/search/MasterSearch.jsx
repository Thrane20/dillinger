import React, { useEffect, useState, useRef } from "react";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";

function MasterSearch() {

    const inputRef = useRef(null);

    const [searchTerm, setSearchTerm] = useState("");

    return (
        <CanvasBackground>
            <p className="text-base line-above-below">Search</p>
            <div className="flex w-full h-full flex-row p-0">
                <div className="flex flex-col w-4/5 h-full p-2">
                    <div className="flex w-full h-[2em]" >
                        <ul className="w-full vertical-line-list text-start" style={{ marginLeft: "-0.9em" }}>
                            <li>
                                <div className="flex w-full h-[2em] items-start justify-start gap-2">
                                    <input ref={inputRef} className="input text-base" type="text" placeholder="Search games"
                                        spellCheck={false} value={searchTerm} style={{ width: "95%" }}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </li>
                        </ul>
                    </div>
                    <div className="flex w-1/5 h-full" >
                        <ul className="w-full vertical-line-list text-start" style={{ marginLeft: "-0.9em" }}>
                            <li>
                                The rest
                            </li>
                        </ul>
                    </div>


                </div>
                <div className="flex w-1/5 h-full">
                    <ul className="w-4/5 vertical-line-list text-start">
                        <li><button className="w-full btn" onClick={()=>searchGamesDB()}>Games DB</button></li>
                        <li><button className="w-full btn" onClick={()=>searchGOG()}>GOG</button></li>
                        <li><button className="w-full btn" onClick={()=>searchSteam()}>Steam</button></li>
                    </ul>
                </div>
            </div>
        </CanvasBackground>
    );
}

export default MasterSearch;