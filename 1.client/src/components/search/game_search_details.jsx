
import React, { useEffect, useState, useContext } from "react";
import { MessageContext } from "../../hooks/MessageProvider";
import searchIcon from "../../assets/icons/magnifying_glass.svg";
import search from "../../logics/game_search";

function GameSearchDetails({ searchDb, slug }) {

    const MODAL_ID = "details_game_remote_modal";
    const { message } = useContext(MessageContext);
    const [searchResults, setSearchResults] = useState({});

    useEffect(() => {
        console.log("details message changed ", message);
        if (message.action === "open" && message.on === "details_game_remote_modal") {
            document.getElementById(MODAL_ID).showModal();
        }
    }, [message]);

    useEffect(() => {
        console.log("slug changed ", slug);
        // If the selected index changes, this runs.
        // So go off to the search engine and get detailed information for this title

        search.getRemoteEntryDetails(searchDb, slug).then((result) => {
            console.log(result);
            setSearchResults(result);
        });
    }, [slug]);

    useEffect(() => {
        // If the search results change, this runs.
        if (searchResults?.name) {
            console.log("search results changed ", searchResults);
        } else {
            console.log("search results empty ", searchResults);
        }
    }, [searchResults]);

    return (

        <dialog id={MODAL_ID} className="modal">
            <div className="modal-box h-4/5 max-w-full">
                <div className="flex flex-col gap-4 h-full w-full">
                    <div className="flex flex-row gap-2 p-1 pb-4 items-center justify-stretch">
                        <img src={searchIcon} alt="search" className="w-6 h-6" />
                        <h3 className="flex w-1/4 flex-0 font-bold text-lg">Game Details - {searchResults?.name}</h3>
                    </div>
                    <hr style={{ backgroundColor: "#ffffff", opacity: 0.3 }} />
                    <div className="flex flex-grow rounded-lg h-full w-full bg-base-300 overflow-y-auto">
                        <div className="flex flex-col gap-4 p-2 w-full">
                            <div className="flex flex-row gap-4 w-full">
                                <div className="w-1/5">
                                    <img width="100px" height="100px" />
                                </div>
                                <p className="font-bold">Summary:</p>
                                <p>{searchResults?.summary}</p>
                            </div>
                            <div className="flex flex-row gap-4 w-full">
                                <div className="flex gap-4">
                                    <p className="font-bold">Genres:</p>
                                    <p>{searchResults?.genres?.join(' | ')}</p>
                                </div>
                                <div style={{ width: "5em" }}></div>
                                <div className="flex gap-4">
                                    <p className="font-bold">Themes:</p>
                                    <p>{searchResults?.themes?.join(' | ')}</p>
                                </div>
                            </div>
                        </div>

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

export default GameSearchDetails;