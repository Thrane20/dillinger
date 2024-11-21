import React, { useState, useEffect } from "react";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";
import Modal from "../../base_controls/Modal";

function DevTest() {

    const [testModalVisible, setTestModalVisible] = useState(false)

    function test_model() {
        setTestModalVisible(!testModalVisible);
    }

    function close() {
        setTestModalVisible(false);
    }

    return (
        <>
            <CanvasBackground>
                <p className="text-base line-above-below">Dev Test</p>
                <ul className="vertical-line-list text-start">
                    <li>
                        <button className="btn" onClick={() => test_model()}>test modal</button>
                    </li>
                    <li>Item 2</li>
                    <li>Item 3</li>
                </ul>

            </CanvasBackground>
            <Modal heading="Testing 123" isVisible={testModalVisible} transparency={0.7}>

                
                <ul className="vertical-line-list text-start">
                    <li>Item 1</li>
                    <li>Item 2</li>
                    <li>Item 3</li>
                </ul>
                <button className="btn" onClick={() => { close() }}>Close</button>


            </Modal>
        </>

    );
}

export default DevTest;