import React, { useState, useEffect, useRef, useContext } from "react";
import { motion } from "framer-motion";
import GameSearchBar from "./game_search_bar";
import GameSearchLocalResults from "./game_search_local_results";
import search from "../../logics/game_search";
import { GlobalStateContext } from "../../hooks/GlobalStateProvider";

// This is a composite class to handle searching for titles locally
function GameSearchLocal() {
  const { setGlobalState } = useContext(GlobalStateContext);
  const gameSearchLocalResultsRef = useRef();

  const [searchTerms, setSearchTerms] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [resultsOpen, setResultsOpen] = useState(false);

  // When the search terms change, we need to update the results
  useEffect(() => {
    // Open or close the results div based on search terms present
    setResultsOpen(searchTerms.length > 0);

    // And go hunting for results
    search.searchLocalEntries(searchTerms).then((result) => {
      setSearchResults(result);
    });
  }, [searchTerms]);

  // User has selected a specific game
  function gameSelected(slug) {
    // This will bubble up to the global state
    // and be picked up by the GameSelectedLocal component
    setGlobalState((state) => {
      return {
        ...state,
        gameSelectedLocal: searchResults.find((game) => game.slug === slug),
      };
    });
  }

  function focusOnResults() {
    if (gameSearchLocalResultsRef.current) {
      if(searchResults.length > 0) {
        gameSearchLocalResultsRef.current.setFocus();
      }
    }
  }

  return (
    <motion.div
      layout
      className="flex flex-col w-full bg-base-200 shadow-md rounded-xl p-4"
      style={{ height: resultsOpen ? "15em" : "" }}
    >
      {/* The search bar will hook the setSearchTerms callback with updates */}
      <GameSearchBar
        setSearchTerms={setSearchTerms}
        focusOnResults={focusOnResults}
      />
      {/* Any game selected by the user will bubble up through the gameSelected function */}
      <GameSearchLocalResults
        ref={gameSearchLocalResultsRef}
        searchResults={searchResults}
        setSelectedGame={gameSelected}
      />
    </motion.div>
  );
}

export default GameSearchLocal;
