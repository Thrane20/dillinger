import React, { useEffect, useState } from "react";

function GameSearchDropdown({ results }) {


    useEffect(() => {
        // what to do...
    }, [results]);

    return (
        <div className="dropdown dropdown-open">
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                {results?.map((result, index) => <li key={index}><a>{result}</a></li>) ?? "Wow. Such empty."}
            </ul>
        </div>
    );
}

export default GameSearchDropdown;