import React, { useEffect, useState, useRef, useContext } from "react";
import AnimatedText from "../../../base_controls/AnimatedText";
import interactor_search from "../../../../interactors/interactor_search";


function InternetDetails({ gameDb, gameSlug }) {

    const [details, setDetails] = useState({});
    const [coverImageUrl, setCoverImageUrl] = useState("");

    useEffect(() => {

        console.log("game_db: ", gameDb);
        console.log("game_slug: ", gameSlug);

        interactor_search.getRemoteTitle(gameDb, gameSlug).then((details) => {
            console.log("getRemoteTitle details: ", details);
            setDetails(details);
        });

    }, [gameDb, gameSlug]);


    useEffect(() => {
        // Process a new update to the details
        if (Object.keys(details).length > 0) {
            console.log("covers: ", details.covers);
            const coverImageId = details.covers[0];
            const calculatedUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverImageId}.jpg`;
            console.log("calculatedUrl: ", calculatedUrl);
            setCoverImageUrl(calculatedUrl);

        }
    }, [details]);

    return (
        <div className="w-full h-full max-h-full overflow-y-auto p-2 relative">
            <div
                className="w-full h-full cover-image"
                style={{
                    backgroundImage: `url(${coverImageUrl})`,
                }}
            ></div>
            {Object.keys(details).length > 0 ? (
                <div>
                    {/* Render details here */}
                    <p className="text-xl">{details.name}</p>
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