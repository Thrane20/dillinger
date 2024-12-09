import React, { useEffect, useState, useRef, useContext } from "react";
import AnimatedText from "../../../base_controls/AnimatedText";
import interactor_search from "../../../../interactors/interactor_search";


function InternetDetails({ gameDb, gameSlug }) {

    const [details, setDetails] = useState({});

    useEffect(() => {

        console.log("game_db: ", gameDb);
        console.log("game_slug: ", gameSlug);

        interactor_search.getRemoteTitle(gameDb, gameSlug).then((details) => {
            console.log("getRemoteTitle details: ", details);
            setDetails(details);
        });

    }, [gameDb, gameSlug]);

    return (
        <div className="w-full h-full max-h-full overflow-y-auto p-2">
            {Object.keys(details).length > 0 ? (
                <div>
                    {/* Render details here */}
                    <h1>{details.name}</h1>
                    <p>{details.description}</p>
                    {/* Add more fields as needed */}
                </div>
            ) : (
                <p>No details available.</p>
            )}
        </div>
    );
}

export default InternetDetails;