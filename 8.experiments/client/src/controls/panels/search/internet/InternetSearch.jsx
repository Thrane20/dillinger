import React, { useEffect, useState, useRef, useContext } from "react";
import AnimatedText from "../../../base_controls/AnimatedText";
import interactor_search from "../../../../interactors/interactor_search";


function InternetSearch({ searchDb, searchTerm, onGameSelected }) {

    const [searchResults, setSearchResults] = useState([]);

    useEffect(() => {

        console.log("searchDb: ", searchDb);
        console.log("searchTerm: ", searchTerm);

        if (searchTerm.length > 0) {
            interactor_search.searchRemote(searchDb, searchTerm).then((results) => {
                console.log("searchRemote results: ", results);
                setSearchResults(results);
            });
        }

    }, [searchDb, searchTerm]);

    const gameSelected = (index) => {
        onGameSelected && onGameSelected(searchResults[index]);   
    };

    return (
        <div className="w-full h-full max-h-full overflow-y-auto p-2">

            <table className="table-auto w-full h-full table-hover">
                <thead>
                    <tr>
                        <th className="px-4 py-2"><p className="text-base text-lg">Name</p></th>
                        <th className="px-4 py-2 text-left"><p className="text-base text-lg">Description</p></th>
                    </tr>
                </thead>
                <tbody>
                    {searchResults.map((result, index) => (
                        <tr key={index} onClick={()=>gameSelected(index)}>
                            <td className="px-4 py-2 text-center"><p className="text-base">{result.name}</p></td>
                            <td className="px-4 py-2 text-left"><p className="text-base">{result.description}</p></td>
                            <td className="px-4 py-2 text-center"><p className="text-base">{result.slug_platform}</p></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default InternetSearch;