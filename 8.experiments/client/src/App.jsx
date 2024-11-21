import React, { useEffect, useState } from 'react'
import './App.css'
import { motion } from "framer-motion";
import Background from "./controls/base_controls/canvas_background/canvas_grid_background.js";

import Test from './controls/Test'
import DevTest from './controls/panels/devtest/DevTest.jsx';
import PanelBaseEngine from './controls/panels/base_engine/PanelBaseEngine.jsx';
import NetworkActivity from './controls/panels/network_activity/NetworkActivity.jsx';
import Logging from './controls/panels/logging/Logging.jsx';
import EventProvider from './EventProvider.jsx';
import LogProvider from './LogProvider.jsx';
import Runners from './controls/panels/runners/Runners.jsx';
import Gamescope from './controls/panels/gamescope/Gamescope.jsx';
import OpenTrack from './controls/panels/opentrack/OpenTrack.jsx';
import ALVR from './controls/panels/vr/ALVR.jsx';
import VolumeExplorer from './controls/panels/volumes/VolumeExplorer.jsx';
import Containers from './controls/panels/containers/Containers.jsx';
import InputManager from './controls/panels/input_manager/InputManager.jsx';
import MasterSearch from './controls/panels/search/MasterSearch.jsx';


function App() {

  const [theme, setTheme] = useState('default');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light');
    if (theme !== 'default') {
      root.classList.add(`theme-${theme}`);
    }
  }, [theme]);

  useEffect(() => {
    const background = new Background();
    background.initialize();
  }, []);

  const switchTheme = (newTheme) => {
    setTheme(newTheme);
  };

  const draw = {
    hidden: { opacity: 0 },
    visible: (i) => {
      const delay = i * 0.5;
      return {
        opacity: 1,
        transition: {
          opacity: { delay, duration: 0.5 }
        }
      };
    }
  };

  return (

    <LogProvider>
      <EventProvider>

        <div id="canvas-wrapper" className="transparent">
          <canvas id="canvas-grid-cells"></canvas>
          <canvas id="canvas-grid-lines"></canvas>
        </div>
        <div className="flex flex-row w-full min-h-screen gap-4">
          <motion.div initial="hidden" animate="visible" className="flex flex-col w-1/6 gap-4">
            <motion.div variants={draw} custom={0} className="flex w-full h-1/4">
              <PanelBaseEngine />
            </motion.div>
            <motion.div variants={draw} custom={1} className="flex w-full h-1/2" >
              <VolumeExplorer />
            </motion.div>
            <motion.div variants={draw} custom={1} className="flex w-full h-1/4" >
              <Containers />
            </motion.div>
          </motion.div>
          <div className="flex flex-col w-1/6 gap-4" >
            <div className="flex w-full h-1/4">
              <Runners />
            </div>
            <div className="flex w-full h-1/4" >
              <Gamescope />
            </div>
            <div className="flex w-full h-1/4" >
              <OpenTrack />
            </div>
            <div className="flex w-full h-1/4" >
              <ALVR />
            </div>
          </div>
          <div className="flex flex-col w-1/2 gap-4" >
            <div className="flex w-full h-1/5" >
              <MasterSearch />
            </div>
            <div className="flex w-full h-3/5 double-lined-border">
              <Test />
            </div>
            <div className="flex w-full h-1/5" >
              <Logging />
            </div>
          </div>
          <div className="flex flex-col w-1/6 gap-4" >
            <div className="flex w-full h-1/5">
              <InputManager />
            </div>
            <div className="flex w-full h-1/5" >
              <Test />
            </div>
            <div className="flex w-full h-1/5" >
              <Test />
            </div>
            <div className="flex w-full h-1/5">
              <DevTest />
            </div>
            <div className="flex w-full h-1/5" >
              <NetworkActivity />
            </div>
          </div>
        </div>
      </EventProvider>
    </LogProvider>
  )
}

export default App
