import React, { useEffect, useState } from "react";

import GameSearchDropdown from "./game_search_dropdown";

function GameSearchBar({ onSearchChanged, searchResults }) {

    const [search, setSearch] = useState('');
    const [resultsOpen, setResultsOpen] = useState(false);

    useEffect(() => {
        onSearchChanged && onSearchChanged(search);
    }, [search]);

    function searchChanged(searchText) {
        // Note: this will invoke our useEffect forcing a new search
        setSearch(searchText);
        // Handle opening and closing of the search results dropdown
        if(resultsOpen && searchText.length === 0) setResultsOpen(false);
        if(!resultsOpen && searchText.length > 0) setResultsOpen(true);
    }

    return (
        <div className="flex flex-col w-full">
            <label className="input input-bordered flex w-full items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 opacity-70"><path fillRule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clipRule="evenodd" /></svg>
                <input type="text" className="grow" placeholder="Search" value={search} onChange={e => searchChanged(e.target.value)}  />
                <p onClick={() => { setResultsOpen(false) }}>CANCEL</p>
            </label>
            {resultsOpen && <GameSearchDropdown results={searchResults} />}
        </div>
    );
}

export default GameSearchBar;