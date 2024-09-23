import React, { useState, useEffect } from 'react';

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const getRandomChar = () => {
    return characters[Math.floor(Math.random() * characters.length)];
};

const AnimatedText = ({ className, text, duration }) => {
    const [displayText, setDisplayText] = useState('');
    const [lockIndex, setLockIndex] = useState(0);



    useEffect(() => {
        const length = text?.length;
        const totalSteps = duration / 50;
        const lockStep = totalSteps / length;
        let intervalId;

        const updateText = () => {
            setDisplayText((prev) => {
                let newText = prev.split('');
                for (let i = lockIndex; i < length; i++) {
                    newText[i] = getRandomChar();
                }
                return newText.join('');
            });

            if (lockIndex < length) {
                setLockIndex((prev) => prev + 1);
            } else {
                clearInterval(intervalId);
            }
        };

        intervalId = setInterval(updateText, 50);

        return () => clearInterval(intervalId);
    }, [text, duration, lockIndex]);

    useEffect(() => {
        if (lockIndex > 0 && lockIndex <= text.length) {
            setDisplayText((prev) => prev.slice(0, lockIndex - 1) + text[lockIndex - 1] + prev.slice(lockIndex));
        }
    }, [lockIndex, text]);

    return <p className={`${className} animated`}>{displayText}</p>;
};

export default AnimatedText;