
import React, { useEffect, useState, useContext } from "react";
import { MessageContext } from "../../hooks/MessageProvider";
import searchIcon from "../../assets/icons/magnifying_glass.svg";
import search from "../../logics/game_search";
import GameSearchBar from "./game_search_bar";

function GameSearchRemote({ title }) {

    const MODAL_ID = "search_remote_modal";
    const { message } = useContext(MessageContext);
    const [searchTitle, setSearchTitle] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searchDb, setSearchDb] = useState("igdb");

    useEffect(() => {
        if (message.action === "open" && message.on === "search_remote_modal") {
            setSearchTitle(message.title);
            document.getElementById(MODAL_ID).showModal();
        }
    }, [message]);

    useEffect(() => {
        setSearchTitle(title);
    }, [title]);

    /// This function will search the internet for the specified title and db platform
    function doSearchIgdb() {
        search.searchRemoteEntries("igdb", searchTitle).then((result) => {
            console.log(result);
            setSearchResults(result);
        }
        );
    }

    return (

        <dialog id={MODAL_ID} className="modal">
            <div className="modal-box h-3/4 w-11/12 max-w-5xl">
                <div className="flex flex-col gap-4 h-full">
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
                                    <th>Release Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchResults.map((result, index) => (
                                    <tr key={index}>
                                        <td>{result.game_db}</td>
                                        <td>{result.name}</td>
                                        <td>date</td>
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

    );

}

export default GameSearchRemote;