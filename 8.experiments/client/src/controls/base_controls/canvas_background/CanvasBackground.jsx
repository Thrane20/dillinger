import React, { useEffect, useRef } from "react";


const CanvasBackground = (props) => {
    const canvasRef = useRef(null);
  
    useEffect(() => {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
  
      // Example: Fill the canvas with a color
      context.fillStyle = 'rgba(173, 216, 230, 0.01)';
      context.fillRect(0, 0, canvas.width, canvas.height);
  
      // TODO: Add more canvas drawing logic here
    }, []);
  
    return (
      <div className="relative w-full h-full">
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full"></canvas>
        <div className="relative z-10 w-full h-full" >
          {props.children}
        </div>
      </div>
    );
  };

export default CanvasBackground;