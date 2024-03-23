import './App.css'
import GameSearchBar from './components/game_search_bar'
import NodeTree from './components/node_tree'

import { searchLocalEntries } from './logics/game_search'

function App() {

  return (
    <div className="flex flex0 w-screen">
      <div className="flex flex-col items-center justify-stretch max-w-full w-full h-screen">
        {/*  */}
        <div className="navbar flex-0 w-full h-16 rounded bg-base-200">
          <div className="flex-1">
            <a className="btn btn-ghost text-xl">Dillinger</a>
          </div>
        </div>
        {/*  */}
        <div className="flex flex-1 w-full mt-4">
          <div className="flex flex-row w-full h-full items-start justify-start gap-4">
            <div className="flex w-1/4 h-full items-start justify-center ml-2">
              <div className="flex bg-base-100 rounded-lg w-full items-start justify-center p-2">
                Left Section
              </div>
            </div>
            <div className="flex flex-col flex-grow h-full items-start justify-center">
              <GameSearchBar onSearchChanged={searchLocalEntries} />
              <div className="flex flex-row w-full h-full items-start justify-start gap-4">
                <NodeTree />
                </div>
            </div>
            <div className="flex w-1/4 h-full items-start justify-center mr-2">
              <div className="flex bg-base-100 rounded-lg w-full items-start justify-center p-2 ">
                Right Section
              </div>
            </div>
          </div>

        </div>
        {/*  */}
        <div className="navbar flex-0 w-full h-24 rounded bg-base-200">
          <a className="btn btn-ghost text-xl">footer</a>
        </div>
      </div>
    </div>
  )
}

export default App
