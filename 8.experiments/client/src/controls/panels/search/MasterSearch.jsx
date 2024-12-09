import React, { useEffect, useState, useRef, useContext } from "react";
import interactor_search from "../../../interactors/interactor_search";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";
import { useApp } from "../../../hooks/useApp";
import InternetSearch from "./internet/InternetSearch";
import InternetDetails from "./internet/InternetDetails";

function MasterSearch() {

    const inputRef = useRef(null);
    const { setHeroAs, setHeroTitle } = useApp();
    const [searchTerm, setSearchTerm] = useState("");
    const [localSearchResults, setLocalSearchResults] = useState([]);

    function searchTermChanged(term) {
        setSearchTerm(term);
    }

    useEffect(() => {

        if (searchTerm.length > 0) {
            interactor_search.searchLocal(searchTerm).then((results) => {
                console.log("searchLocal results: ", results);
                setLocalSearchResults(results);
            });
        }

    }, [searchTerm]);

    const onGameSelected = (game) => {
        console.log("gameSelected: ", game);
        setHeroAs(<InternetDetails gameDb={game.game_db} gameSlug={game.slug_game} />);
        setHeroTitle("Game Details (IGDB)");
    }

    function searchIGDB() {
        console.log("searching IGDB");
        setHeroAs(<InternetSearch searchDb="igdb" searchTerm={searchTerm} onGameSelected={onGameSelected} />);
        setHeroTitle("Searching Remote (IGDB)");
    }

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
                                        onChange={(e) => searchTermChanged(e.target.value)}
                                    />
                                </div>
                            </li>
                        </ul>
                    </div>
                    <div className="flex w-full h-full overflow-auto" >
                        <ul className="w-full vertical-line-list text-start" style={{ marginLeft: "-0.9em" }}>
                            {localSearchResults.length > 0 ? (
                                localSearchResults.map((result, index) => (
                                    <li key={index} className="flex w-full h-[2em] items-start justify-start gap-2">
                                        <p className="text-base">{result.slug}</p>
                                    </li>
                                ))
                            ) : (
                                <li className="flex w-full h-[2em] items-start justify-start gap-2">
                                    Wow! such empty...
                                </li>
                            )}
                        </ul>
                    </div>


                </div>
                <div className="flex w-1/5 h-full">
                    <ul className="w-4/5 vertical-line-list text-start">
                        <li><button className="w-full btn" onClick={() => searchIGDB()}>IGDB</button></li>
                        <li><button className="w-full btn" onClick={() => searchGOG()}>GOG</button></li>
                        <li><button className="w-full btn" onClick={() => searchSteam()}>Steam</button></li>
                    </ul>
                </div>
            </div>
        </CanvasBackground>
    );
}

export default MasterSearch;