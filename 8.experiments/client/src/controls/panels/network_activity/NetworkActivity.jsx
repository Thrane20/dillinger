import React, { useEffect, useState } from "react";
import { useEvent } from "../../../hooks/useEvent";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";
import AnimatedText from "../../base_controls/AnimatedText";
import { Sparklines, SparklinesLine } from "react-sparklines";

function NetworkActivity() {

    const max_bandwidth_values = 10;


    const { event } = useEvent();
    const [filesTransferring, setFilesTransferring] = useState(0);
    const [totalBandwidth, setTotalBandwidth] = useState(0);
    const [bandwidthArray, setBandwidthArray] = useState(new Array(max_bandwidth_values).fill(0));

    useEffect(() => {
        // We only handle results from the server in string format (socket message)
        if (event && typeof event === "string") {
            let eventObj = JSON.parse(event);
            if (eventObj.component === "network") {
                setFilesTransferring(eventObj.file_transfers.length);
                setTotalBandwidth(eventObj.total_bandwidth);

                // Keep the last <max_bandwidth_values-1> bandwidth values and 
                // insert new at <max_bandwidth_values>
                setBandwidthArray(prevArray => {
                    const newArray = [...prevArray, eventObj.total_bandwidth];
                    return newArray.length > max_bandwidth_values ? newArray.slice(-max_bandwidth_values) : newArray;
                });
            }
        }
    }, [event]);

    return (
        <CanvasBackground>
            <div className="flex flex-col w-full h-full items-center justify-center">
                <p className="text-base line-above-below w-full">Network Activity</p>
                <div className="flex flex-row w-full h-1/2">
                    <div className="flex w-2/3 h-full">
                        <ul className="vertical-line-list text-start">
                            <li><AnimatedText text="Here is a test" duration={3000} /></li>
                            <li>File Transferring: {filesTransferring}</li>
                        </ul>
                    </div>
                    <div className="flex flex-col w-1/3 h-full align-center justify-center p-0">
                    <p className="flex items-start justify-start text-xs">mbps</p>
                        <p className="flex items-start justify-start text-4xl w-full h-3/4" >
                            {(totalBandwidth / 8000).toFixed(1).padStart(4, '0')}
                        </p>
                    </div>
                </div>
                <div className="flex w-full h-1/2 m-4 thin-border">
                    <Sparklines data={bandwidthArray} limit={max_bandwidth_values} width={60} height={10} margin={2} >
                        <SparklinesLine color='var(--color-neutral)' style={{ fillOpacity: "0" }} />
                    </Sparklines>
                </div>
            </div>
        </CanvasBackground >
    );
}

export default NetworkActivity;