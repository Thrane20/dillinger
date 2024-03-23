import { useEffect, useState, useRef } from "react";
import { InitSketch, forceGraph } from "./node_tree_sketch";

function NodeTree() {
	const p5ContainerRef = useRef();
	var p5Instance = null;

	function nodeClicked(node) {
		// TODO: handle the selected node here
		if (node) {
			console.log("clicked on node: " + node.content);
		}
	}


	useEffect(() => {

		if(!p5Instance) {
			p5Instance = InitSketch(p5ContainerRef.current);
			console.log(p5Instance);

			let props = {};

			// We want our canvas size to fit the parent div
			let width = p5ContainerRef.current.offsetWidth;
			let height = p5ContainerRef.current.offsetHeight;
			props.width = width;
			props.height = height;

			props.rootNode = forceGraph();
			props.handleClick = nodeClicked;

			// Send our update payload to p5 - it will handle the rest
			p5Instance.handleNewData(props);
		}

		// On component destruction, delete the p5 instance
		return () => {
			p5Instance.remove();
		};


	}, []);

	return (
		<div className="flex w-full h-full">
			<div className="flex flex1 w-full h-full" ref={p5ContainerRef} style={{ border: "1px solid black" }}></div>
		</div>
	);
}

export default NodeTree;
