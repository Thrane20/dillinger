import "./App.css";
import React, { useEffect, useState, createContext, useContext } from "react";
import { motion } from "framer-motion";
import GameSearchBar from "./components/game_search_bar";
import Header from "./components/header";
import MessageContext from "./hooks/MessageProvider";
import NodeTree from "./components/node_tree";
import SectionLeft from "./sections/left";
import SectionMiddle from "./sections/middle";
import SectionRight from "./sections/right";
import MessageProvider from "./hooks/MessageProvider";

function App() {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <MessageProvider>
      <div className="flex flex0 w-screen p-2">
        <div className="flex flex-col items-center justify-stretch max-w-full w-full h-screen p-2 gap-2">
          {/*  */}
          <div className="navbar flex-0 w-full h-16 rounded-xl bg-base-200 shadow-md">
            <div className="flex-1">
              <Header />
            </div>
          </div>
          {/*  */}
          <div className="flex flex-1 w-full m-2">
            {/* Our 3 primary columns - left, middle, and right */}
            <div className="flex flex-row w-full h-full items-start justify-start gap-4">
              {/* Left Column */}
              <div className="flex w-1/5 h-full items-start justify-center">
                <SectionLeft />
              </div>
              {/* Middle Column */}
              <div className="flex flex-col flex-grow items-start justify-center">
                <SectionMiddle />
                <div className="flex flex-row w-full h-full items-start justify-start gap-4">
                  {/* <NodeTree /> */}
                </div>
              </div>
              <div className="flex w-1/4 h-full items-start justify-center">
                {/* <div className="flex bg-base-100 rounded-lg w-full items-start justify-center p-2 "> */}
                <SectionRight />
                {/* </div> */}
              </div>
            </div>
          </div>
          {/*  */}
          <div className="navbar flex-0 w-full h-16 rounded bg-base-200 mb-4">
            <a className="btn btn-ghost text-xl">footer</a>
          </div>
        </div>
      </div>
    </MessageProvider>
  );
}

export default App;
