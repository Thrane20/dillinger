import React, { useEffect, useState } from "react";

function GameSearchLocalResults({ searchResults, setSelectedGame }) {
  useEffect(() => {
    console.debug("Search results: ", searchResults);
  }, [searchResults]);

  function handleRowClick(slug) {
    setSelectedGame(slug);
  }

  return (
    searchResults?.length > 0 && (
      <div className="flex w-full mt-4">
        <div className="overflow-x-auto overflow-y-auto w-full max-h-[10em]">
          <table className="table table-sm table-pin-rows  table-pin-cols w-full" >
            <thead>
              <th className="text-lg">slug</th>
              <th className="text-lg">Name</th>
              <th className="text-lg">Description</th>
              <th className="text-lg">Platforms</th>
              <th className="text-lg">slug</th>
            </thead>
            <tbody>
              {searchResults.map((result, index) => (
                <tr key={result.slug} className="hover:text-primary" onClick={() => handleRowClick(result.slug)}>
                  <td>{result.slug}</td>
                  <td>{result.name}</td>
                  <td>{result.description}</td>
                  <td>TODO</td>
                  <td>{result.slug}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  );
}

export default GameSearchLocalResults;
