import React, {
  useEffect,
  useState,
  useRef,
  useContext,
  forwardRef,
  useImperativeHandle,
} from "react";

import { LogContext } from "../../hooks/LogProvider";

const GameSearchLocalResults = forwardRef(
  ({ searchResults, setSelectedGame }, ref) => {

    // Get a handle to the global LogContext
    const { createLog, appendLog } = useContext(LogContext);

    const [selectedIndex, setSelectedIndex] = useState(-1);
    const scrollViewRef = useRef(null);
    const selectedRowRef = useRef(null); // Ref for the selected row
    const rowsRef = useRef([]);

    // Adjust focus and scroll for the selected row
    useEffect(() => {
      if (selectedRowRef.current) {
        selectedRowRef.current.focus();
        selectedRowRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }, [selectedIndex]);

    function handleRowClick(slug) {
      appendLog(createLog(`Selected game: ${slug}`));
      setSelectedGame(slug);
    }

    // Handle keydown events for navigation
    const handleKeyDown = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prevIndex) =>
          Math.min(prevIndex + 1, searchResults.length - 1)
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prevIndex) => Math.max(prevIndex - 1, 0));
      }
    };

    // Use useImperativeHandle to expose specific functions to the parent component
    useImperativeHandle(ref, () => ({
      setFocus: () => {
        scrollViewRef.current.focus();
        setSelectedIndex(0);
      },
    }));

    return (
      searchResults?.length > 0 && (
        <div className="flex w-full mt-4" tabIndex={0}>
          <div className="overflow-x-auto overflow-y-auto w-full max-h-[10em] ">
            <table
              ref={scrollViewRef}
              tabIndex={-1}
              onKeyDown={handleKeyDown}
              className="table table-sm  w-full"
            >
              <thead>
                <tr>
                  <th className="text-lg">slug</th>
                  <th className="text-lg">Name</th>
                  <th className="text-lg">Description</th>
                  <th className="text-lg">Platforms</th>
                  <th className="text-lg">slug</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((result, index) => (
                  <tr
                    key={result.slug}
                    ref={index === selectedIndex ? selectedRowRef : null} // Apply ref to the selected row
                    tabIndex="0"
                    className={`text-lg focus:outline-none ${
                      index === selectedIndex ? "bg-blue-500 text-black text-2xl" : ""
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRowClick(result.slug, index);
                      }
                    }}
                    onClick={() => handleRowClick(result.slug, index)}
                  >
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
);

export default GameSearchLocalResults;
