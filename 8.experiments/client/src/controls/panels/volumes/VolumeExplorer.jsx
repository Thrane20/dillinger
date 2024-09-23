import React, { useEffect, useState, useRef } from "react";
import CanvasBackground from "../../base_controls/canvas_background/CanvasBackground";
import SvgFolder from "./SvgFolder";
import AnimatedText from "../../base_controls/AnimatedText";
import { service_interactor } from "./service_interactor";

function VolumeExplorer() {

    const iconsPerRow = 3;
    const maxTextLength = 12;
    const maxVolumeNameLength = 25;
    const initialDirectoryPath = '/Users/iansorbello/Documents/dev_arrakis/dillinger/2.server/dev_root_dir/';

    const inputRef = useRef(null);

    const [directoryPath, setDirectoryPath] = useState(initialDirectoryPath);
    const [pathSegments, setPathSegments] = useState([]);
    const [directoryContents, setDirectoryContents] = useState([]);
    const [dockerVolumeSelected, setDockerVolumeSelected] = useState(-1);
    const [dockerVolumes, setDockerVolumes] = useState(["volume really large name and then some more", "volume2", "volume3", "volume4", "volume5"]);

    // Function to push an directory into the return back stack
    const pushToStack = (element) => {
        setPathSegments([...pathSegments, element]);
    };

    // Function to pop an element from the return back stack
    const popFromStack = () => {
        if (pathSegments.length === 0) {
            console.log("Stack is empty");
            return;
        }
        const newStack = [...pathSegments];
        const poppedElement = newStack.pop();
        setPathSegments(newStack);
        return makePathFromSegments(newStack);
    };

    const getPathSegments = (path) => {
        const segments = path.split('/');
        return segments.filter(segment => segment !== '');
    }

    const makePathFromSegments = (segments) => {
        return '/' + segments.join('/') + '/';
    }

    useEffect(() => {

        let s = getPathSegments(initialDirectoryPath);
        console.log(s);
        setPathSegments(s);

        // Retrive docker volumes on mount
        service_interactor.get_volumes().then((volumes) => {
            setDockerVolumes(volumes.map(volume => volume.name));
        }).catch((error) => {
            setDockerVolumes([]);
        });

        // Retrieve a list of files and folders from the current directory
        service_interactor.list_directory_contents(directoryPath).then((contents) => {
            setDirectoryContents(contents);
        }).catch((error) => {
            setDirectoryContents(contents);
        });

    }, []);

    // Scroll to the right when the directory path changes
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.scrollLeft = inputRef.current.scrollWidth;
        }
    }, [directoryPath]);

    const volumeClicked = (index) => {
        setDockerVolumeSelected(index);
    }

    const mountVolume = (index) => {
        console.log(`Mounting volume ${dockerVolumes[index]}`);
        service_interactor.list_volume_contents(dockerVolumes[index], '/').then((contents) => {
            console.log(contents);
        }
        ).catch((error) => {
            console.log(error);
        });
    }

    const searchDirectory = () => {
        setPreviousDirectoryPath([]);
        service_interactor.list_directory_contents(directoryPath).then((contents) => {
            setDirectoryContents(contents);
        }).catch((error) => {
            setDirectoryContents(contents);
        });
    }

    const directorySelectedForFolder = (index) => {
        var newPath = directoryPath + directoryContents.folders[index] + '/';
        pushToStack(directoryPath);
        setDirectoryPath(newPath);
        console.log(`Searching directory ${newPath}`);
        service_interactor.list_directory_contents(newPath).then((contents) => {
            setDirectoryContents(contents);
        }).catch((error) => {
            setDirectoryContents(contents);
        });
    }

    const previousDirectorySelected = () => {
        var previous = popFromStack();
        console.log(previous);
        setDirectoryPath(previous);
        service_interactor.list_directory_contents(previous).then((contents) => {
            setDirectoryContents(contents);
        }).catch((error) => {
            setDirectoryContents(contents);
        });
    }

    const truncateText = (text, length) => {
        if (text?.length > length) {
            return text.substring(0, length) + '...';
        }
        return text;
    }


    return (
        <CanvasBackground>
            <div className="flex flex-col h-full w-full gap-2">
                <p className="text-base line-above-below">Volume Explorer</p>
                <div className="flex flex-col w-full h-full gap-4">
                    <p className="text-primary text-start">Volumes - ({dockerVolumes.length})</p>
                    <div className="flex flex-col gap-4 w-full h-1/5 items-start mb-4 overflow-y-auto thin-border-left thin-scrollbar" style={{ marginLeft: "0.5em" }}>
                        <ul className="vertical-line-list text-start w-full">
                            {dockerVolumes.length > 0 ? (
                                dockerVolumes.map((volume, index) => (
                                    <li className="cursor-pointer"
                                        key={index}
                                        style={index === dockerVolumeSelected ? { display: "block", width: "90%", padding: '0', backgroundColor: 'rgba(var(--color-primary-rgb),0.3)', color: 'black' } : {}}
                                        onClick={() => { volumeClicked(index); }}
                                    >
                                        <div className="flex flex-row gap-4 justify-between">
                                            <p className="color-primary">{truncateText(volume, maxVolumeNameLength)}</p>
                                            <button className="btn-tiny" onClick={() => mountVolume(index)}><p className="text-xs">M<p></p></p></button>
                                        </div>
                                    </li>
                                ))
                            ) : (
                                <AnimatedText className="color-error text-xs" text="Docker volume query failed - Docker is probably not running" duration={3000} />
                            )}
                        </ul>
                    </div>

                    <p className="text-primary text-start">Directories</p>

                    <ul className="vertical-line-list text-start" style={{ marginLeft: "-0.9em" }}>
                        <li>
                            <div className="flex w-full h-[2em] items-center justify-center gap-4">
                                <input ref={inputRef} className="input" type="text" placeholder="Search directories"
                                    spellCheck={false} value={directoryPath} style={{ width: "95%" }}
                                    onChange={(e) => setDirectoryPath(e.target.value)}
                                />
                                <button className="btn-outline" style={{ width: "1em" }} onClick={() => searchDirectory()}>{">"}</button>
                            </div>
                        </li>
                    </ul>


                    <div className="flex flex-row w-full h-full items-start justify-center overflow-y-auto thin-border-left thin-scrollbar">
                        <div className="folder-icons-grid h-full" style={{ gridTemplateColumns: `repeat(${iconsPerRow}, 1fr)` }}>

                            <div key={`back-button`} className="flex flex-col gap-4 items-center justify-start" onMouseDown={() => previousDirectorySelected()}>
                                <SvgFolder className={`flex-shrink-0 color-primary icon-xs mr-3`} size="icon-base" />
                                <p className="color-neutral text-xs folder-text">UP</p>
                            </div>

                            {directoryContents?.folders?.map((item, index) => (
                                <div key={`folder-${index}`} className="flex flex-col gap-4 items-center justify-start" onMouseDown={() => directorySelectedForFolder(index)}>
                                    <SvgFolder className={`flex-shrink-0 color-primary icon-xs mr-3`} size="icon-base" />
                                    <p className="color-neutral text-xs folder-text">{truncateText(item, maxTextLength)}</p>
                                </div>
                            ))}
                            {directoryContents?.files?.map((item, index) => (
                                <div key={`file-${index}`} className="flex flex-col gap-4 items-center justify-start" >
                                    <SvgFolder className={`flex-shrink-0 color-primary icon-xs mr-3`} size="icon-base" />
                                    <p className="color-neutral text-xs folder-text">{truncateText(item, maxTextLength)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

        </CanvasBackground >
    );
}

export default VolumeExplorer;