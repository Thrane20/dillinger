import { useEffect, useState } from 'react'
import './App.css'
import { motion } from "framer-motion";
import Background from "./controls/base_controls/canvas_background/canvas_grid_background.js";

import Test from './controls/Test'
import PanelBaseEngine from './controls/panels/base_engine/PanelBaseEngine.jsx';

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
    <>
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
            <Test />
          </motion.div>
          <div className="flex w-full h-1/4" >
            <Test />
          </div>
        </motion.div>
        <div className="flex flex-col w-1/6 gap-4" >
          <div className="flex w-full h-1/4">
            <Test />
          </div>
          <div className="flex w-full h-1/4" >
            <Test />
          </div>
          <div className="flex w-full h-1/4" >
            <Test />
          </div>
          <div className="flex w-full h-1/4" >
            <Test />
          </div>
        </div>
        <div className="flex flex-col w-1/2 gap-4" >
          <div className="flex w-full h-3/5 double-lined-border">
            <Test />
          </div>
          <div className="flex w-full h-1/5" >
            <Test />
          </div>
          <div className="flex w-full h-1/5" >
            <Test />
          </div>
        </div>
        <div className="flex flex-col w-1/6 gap-4" >
          <div className="flex w-full h-1/5">
            <Test />
          </div>
          <div className="flex w-full h-1/5" >
            <Test />
          </div>
          <div className="flex w-full h-1/5" >
            <Test />
          </div>
          <div className="flex w-full h-1/5">
            <Test />
          </div>
          <div className="flex w-full h-1/5" >
            <Test />
          </div>
        </div>
      </div>
    </>
  )
}

export default App
