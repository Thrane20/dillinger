import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import CanvasBackground from './canvas_background/CanvasBackground';

const Modal = ({ heading, isVisible, children, onClose, transparency = 0.01 }) => {
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (!isVisible) {
            setIsAnimating(true);
            setTimeout(() => {
                setIsAnimating(false);
                onClose();
            }, 500); // Duration of the animation
        }
    }, [isVisible, onClose]);

    return (

        <div className={`${isVisible || isAnimating ? 'block' : 'hidden'}`}>
            <CanvasBackground transparency={0.3}>
                <div className="fixed inset-0 z-50">
                    <div className="fixed inset-0" style={{ backgroundColor: `rgba(20, 20, 20, ${transparency / 2})` }}></div>
                    <motion.div
                        initial={{ height: 0, y: '25%' }}
                        animate={{ height: isVisible ? '50%' : 0, y: '25%' }}
                        transition={{ duration: 0.5 }}
                        className="fixed inset-0 flex items-center justify-center"
                    >
                        <div className="double-lined-border w-1/2 h-full p-4 rounded shadow-lg relative" style={{ backgroundColor: `rgba(0, 20, 20, ${transparency})` }}>
                            <p className="text-base line-above-below">Modal Test</p>
                            {children}
                        </div>
                    </motion.div>
                </div>
            </CanvasBackground>
        </div>
    );
};

export default Modal;