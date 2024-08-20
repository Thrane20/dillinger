
import React, { useEffect, useState, useContext } from "react";
import { MessageContext } from "../../hooks/MessageProvider";
import searchIcon from "../../assets/icons/magnifying_glass.svg";
import search from "../../logics/game_search";
import GameSearchDetails from "./game_search_details";

function GameSearchRemote({ title }) {

    const MODAL_ID = "search_remote_modal";
    const { message, setMessage } = useContext(MessageContext);
    const [searchTitle, setSearchTitle] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searchDetails, setSearchDetails] = useState({});
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [searchDb, setSearchDb] = useState("igdb");
    const [gameSlug, setGameSlug] = useState("");

    useEffect(() => {
        if (message.action === "open" && message.on === "search_remote_modal") {
            setSearchTitle(message.title);
            document.getElementById(MODAL_ID).showModal();
        }
    }, [message]);

    useEffect(() => {
        setSearchTitle(title);
    }, [title]);

    useEffect(() => {
        // If the selected index changes, this runs.
        if (selectedIndex > -1)
            setMessage({
                action: "open", on: "details_game_remote_modal"
            });
            setGameSlug(searchResults[selectedIndex]?.slug_game);
    }, [selectedIndex]);

    /// This function will search the internet for the specified title and db platform
    function doSearchIgdb() {
        search.searchRemoteEntries("igdb", searchTitle).then((result) => {
            console.log(result);
            setSearchResults(result);
        }
        );
    }

    function titleSelected(index) {
        setSelectedIndex(index);
    }

    return (

        <>
            {/* Game details is another modal on top of this modal */}
            {/* It's invoked when a search title is selected */}
            <GameSearchDetails slug={gameSlug} searchDb={searchDb} />
            {/* Otherwise, here's the search controls for this modal */}
            <dialog id={MODAL_ID} className="modal">
                <div className="modal-box h-3/4 max-w-full">
                    <div className="flex flex-col gap-4 h-full w-full">
                        <div className="flex flex-row gap-2 p-1 pb-4 items-center justify-stretch">
                            <img src={searchIcon} alt="search" className="w-6 h-6" />
                            <h3 className="flex w-1/4 flex-0 font-bold text-lg">Remote Game Search</h3>
                            <input type="text" className="flex flex-basis w-full input input-bordered form-control" value={searchTitle} onChange={(e) => setSearchTitle(e.target.value)} />
                        </div>
                        <hr style={{ backgroundColor: "#ffffff", opacity: 0.3 }} />
                        <div className="flex flex-row">
                            <button className="btn btn-primary" onClick={() => doSearchIgdb()}>Search IDGB</button>
                        </div>
                        <div className="flex flex-grow rounded-lg h-full w-full bg-base-300 overflow-y-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Game DB</th>
                                        <th>Name</th>
                                        <th>Platform(s)</th>
                                        <th>Release Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {searchResults.map((result, index) => (
                                        <tr key={index} className="hover cursor-pointer" onClick={() => titleSelected(index)}>
                                            <td>{result.game_db}</td>
                                            <td className="w-1/3">{result.name}</td>
                                            <td>{result.slug_platform}</td>
                                            <td className="w-1/6">{new Date(result.release_date * 1000).toISOString().split('T')[0]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex modal-action">
                            <form method="dialog">
                                {/* if there is a button, it will close the modal */}
                                <button className="btn">Close</button>
                            </form>
                        </div>
                    </div>
                </div>
            </dialog>
        </>
    );

}

export default GameSearchRemote;