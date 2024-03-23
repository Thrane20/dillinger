import p5 from "p5";
import playFont from "../assets/fonts/Play-Regular.ttf";
import glassIcon from "../assets/icons/magnifying_glass.svg";
import romIcon from "../assets/icons/rom2.svg";
import engineIcon from "../assets/icons/engine.svg";
import gameStartIcon from "../assets/icons/game_start.svg";
import screenshotIcon from "../assets/icons/screenshot.svg";
import articleIcon from "../assets/icons/article.svg";
import instructionsIcon from "../assets/icons/instructions.svg";
import downloadIcon from "../assets/icons/download.svg";
import installerIcon from "../assets/icons/installer.svg";
import scraperIcon from "../assets/icons/scraper.svg";

export function Node(id, content, svg, svgWidth, svgHeight, lineOffset) {
	this.id = id;
	this.type = "rect";
	this.svg = svg;
	this.content = content;
	this.parent = null;
	this.children = [];
	this.x = 0;
	this.y = 0;
	this.width = 80;
	this.height = 80;
	this.lineOffset = lineOffset || 20;
	this.distance = 0;
	this.svgWidth = svgWidth || 50;
	this.svgHeight = svgHeight || 50;
	this.colour = { r: 50, g: 120, b: 180, a: 255 };
}

Node.prototype.addChild = function (child) {
	child.parent = this;
	this.children.push(child);
};

Node.prototype.mouseHit = function (x, y, panX, panY, zoom) {
	// Transform the mouse coordinates
	let transformedX = (x - panX) / zoom;
	let transformedY = (y - panY) / zoom;

	if (transformedX === 0 && transformedY === 0) {
		return false;
	} else {
		return (
			transformedX > this.x - this.width / 2 &&
			transformedX < this.x + this.width / 2 &&
			transformedY > this.y - this.height / 2 &&
			transformedY < this.y + this.height / 2
		);
	}
};

Node.prototype.getNodeArray = function () {
	let nodes = [];
	nodes.push(this);
	for (let i = 0; i < this.children.length; i++) {
		nodes = nodes.concat(this.children[i].getNodeArray());
	}
	return nodes;
};

Node.prototype.getWidth = function () {
	return this.svg && typeof (this.svg !== "undefined") ? this.svgWidth : this.width;
};

Node.prototype.getHeight = function () {
	return this.svg && typeof (this.svg !== "undefined") ? this.svgHeight : this.height;
};

export function forceGraph() {
	// The passed in nodes are mindmap style "tree", we need to convert to a force graph style
	// Start with the root
	let root = new Node(0, "Root Node - All", null, 50, 50, 20);
	let child1 = new Node(1, "Search", "screenshotIcon", 50, 50, 20);
	let child2 = new Node(2, "Rom File");
	let grandchild1 = new Node(3, "Runner");
	let grandchild2 = new Node(4, "Start");
	let grandchild3 = new Node(5, "Screenshots");
	let grandchild4 = new Node(6, "Articles");
	let grandchild5 = new Node(7, "Instructions");
	let grandchild6 = new Node(8, "Download");
	let grandchild7 = new Node(9, "Run Installer");
	let grandchild8 = new Node(10, "Grandchild 8");
	let grandchild9 = new Node(11, "Grandchild 9");
	let grandchild10 = new Node(12, "Grandchild 10");

	let grandchild11 = new Node(13, "Grandchild 11");
	let grandchild12 = new Node(14, "Grandchild 12");
	let grandchild13 = new Node(15, "Grandchild 13");
	let grandchild14 = new Node(16, "Grandchild 14");

	let grandchild15 = new Node(17, "Grandchild 15");
	let grandchild16 = new Node(18, "Grandchild 16");
	let grandchild17 = new Node(19, "Grandchild 17");
	let grandchild18 = new Node(20, "Grandchild 18");

	root.addChild(child1);
	root.addChild(child2);
	child1.addChild(grandchild1);
	grandchild1.addChild(grandchild2);
	child2.addChild(grandchild3);
	child2.addChild(grandchild4);
	child2.addChild(grandchild5);
	child2.addChild(grandchild6);
	grandchild6.addChild(grandchild7);
	grandchild6.addChild(grandchild8);
	grandchild6.addChild(grandchild9);
	grandchild6.addChild(grandchild15);
	grandchild6.addChild(grandchild16);
	grandchild6.addChild(grandchild17);
	grandchild6.addChild(grandchild18);

	grandchild2.addChild(grandchild11);
	grandchild2.addChild(grandchild12);
	grandchild2.addChild(grandchild13);
	grandchild2.addChild(grandchild14);
	return root;
}

export function InitSketch(container) {
	return new p5(sketch, container);
}

function sketch(p) {
	p.calculateViewPortCentre = function () {
		return { x: width / 2, y: height / 2 };
	};

	var constructed = false;
	var width = 400;
	var height = 400;
	var rootNode = null;
	var nodeArray = [];
	var icons = {};
	var font = null;
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	var forceGraphMovement = Infinity;
	var maxAverageMovement = 0;
	let zoom = 1;
	var origin = { x: 0, y: 0 };
	var targetPanX = 0;
	var targetPanY = 0;
	let panX = 0;
	let panY = 0;
	let easing = 0.05;
	let panningAnim = false;
	let baseDistance = 150;
	let clickHandler = null;


	p.preload = function () {
		font = p.loadFont(playFont);

		// List of SVG icon names
		icons["glassIcon"] = p.loadImage(glassIcon);
		icons["romIcon"] = p.loadImage(romIcon);
		icons["engineIcon"] = p.loadImage(engineIcon);
		icons["gameStartIcon"] = p.loadImage(gameStartIcon);
		icons["screenshotIcon"] = p.loadImage(screenshotIcon);
		icons["articleIcon"] = p.loadImage(articleIcon);
		icons["instructionsIcon"] = p.loadImage(instructionsIcon);
		icons["downloadIcon"] = p.loadImage(downloadIcon);
		icons["installerIcon"] = p.loadImage(installerIcon);
		icons["scraperIcon"] = p.loadImage(scraperIcon);
		
		
	};

	// p is a reference to the p5 instance this sketch is attached to
	p.setup = function () {
		p.createCanvas(width, height);
		p.clear();
		p.pixelDensity(window.devicePixelRatio);
		p.textFont(font);
		p.frameRate(30);
	};

	p.mouseWheel = function (event) {
		event.preventDefault();
		// event.delta is positive if scrolling up, and negative if scrolling down
		zoom += event.delta * 0.001; // Change this value to adjust the zoom speed
		zoom = p.constrain(zoom, 0.5, 3); // Constrain the zoom level between 0.1 and 5
	};

	p.mouseDragged = function () {
		if (p.mouseX >= 0 && p.mouseY >= 0 && p.mouseX <= p.width && p.mouseY <= p.height) {
			// Stop the panning animation
			panningAnim = false;

			// Calculate how much the mouse has moved since the last frame
			let dx = p.mouseX - p.pmouseX;
			let dy = p.mouseY - p.pmouseY;

			// Update the pan values
			panX += dx;
			panY += dy;
		}
	};

	p.draw = function () {
		// your draw code here
		p.clear();
		p.translate(origin.x, origin.y);
		
		// Calculate the difference between the target and current pan values
		if (panningAnim) {
			let dx = targetPanX - panX;
			let dy = targetPanY - panY;

			// Move the current pan values towards the target
			if (Math.abs(dx) > 0.01) {
				panX += dx * easing;
			}
			if (Math.abs(dy) > 0.01) {
				panY += dy * easing;
			}
		}
		p.translate(panX, panY); // Apply the pan values
		p.scale(zoom); // Apply the zoom level
		p.translate(panX, panY);

		if (rootNode) {
			if (!constructed) {
				p.constructTree(rootNode, 0, 0, Math.PI / 4, baseDistance);
				constructed = true;
			}

			p.drawPreConstructedTree(rootNode);

			// After the tree is drawn
			let treeWidth = maxX - minX;
			let treeHeight = maxY - minY;

			// Calculate the scale factor
			let scaleFactor = Math.min(p.width / treeWidth, p.height / treeHeight);

			// Redraw the tree with the scale factor
			p.clear();
			p.drawPreConstructedTree(rootNode);

			// Apply forces
			if (forceGraphMovement.averageMovement < maxAverageMovement * 0.4) {
				// If the average movement is less than 65% of the max, don't apply force
			} else {
				// Keep squeezing the tree until the average movement is less than 70% of the max
				forceGraphMovement = p.applyForces(nodeArray);
				maxAverageMovement = Math.max(maxAverageMovement, forceGraphMovement.averageMovement);
			}
		}

		p.translate(-p.mouseX, -p.mouseY); // Move the origin back
	};

	p.drawPreConstructedTree = function (node) {
		let rectWidth = node.width;
		let rectHeight = node.height;
		minX = Math.min(minX, node.x - rectWidth / 2);
		minY = Math.min(minY, node.y - rectHeight / 2);
		maxX = Math.max(maxX, node.x + rectWidth / 2);
		maxY = Math.max(maxY, node.y + rectHeight / 2);

		// iterate the nodes
		let numChildren = node.children?.length ?? 0;
		for (let i = 0; i < numChildren; i++) {
			// p.stroke("black");
			// p.line(node.x, node.y, node.children[i].x, node.children[i].y);
			p.drawVectorLine(
				node.x,
				node.y,
				node.children[i].x,
				node.children[i].y,
				node.getWidth() - node.lineOffset,
				node.getHeight() - node.lineOffset,
				node.children[i].getWidth() - node.children[i].lineOffset,
				node.children[i].getHeight() - node.children[i].lineOffset
			);
			p.drawPreConstructedTree(node.children[i]);
		}

		if (node.svg && typeof (node.svg) !== "undefined") {
			
			p.image(icons[node.svg], node.x - node.getWidth() / 2, node.y - node.getHeight() / 2, node.svgWidth, node.svgHeight);
			let textSize = 18;
			p.textSize(textSize);
			let textWidth = p.textWidth(node.content);
			let rectX = node.x - textWidth / 2;
			let rectY = node.y + rectHeight / 2;
			let rWidth = textWidth;
			let rHeight = 20; // Adjust this value as needed

			// Draw the rectangle
			p.fill("green"); // Set the fill color to blue
			p.noStroke(); // No border
			p.rect(rectX - 5, rectY + rHeight/4, rWidth + 10, rHeight, 4);

			// Draw the text
			p.fill("white"); // Set the fill color to green
			p.text(node.content, node.x - textWidth / 2, node.y + rectHeight / 2 + 20);
		} else {
			p.noStroke();
			p.fill(node.p5Colour);
			p.rect(node.x - rectWidth / 2, node.y - rectHeight / 2, rectWidth, rectHeight, 10);
			// draw the text
			let textSize = 18;
			p.textSize(textSize);
			while (p.textWidth(node.content) > rectWidth && textSize > 0) {
				textSize--;
				p.textSize(textSize);
			}
			let textWidth = p.textWidth(node.content);
			p.fill("black");
			p.text(node.content, node.x - textWidth / 2, node.y - rectHeight / 2 + 20);
		}
	};

	p.drawVectorLine = function (x1, y1, x2, y2, w1, h1, w2, h2) {
		let dx = x1 - x2;
		let dy = y1 - y2;

		// Calculate the distance between the nodes
		let dist = Math.sqrt(dx * dx + dy * dy);

		// Normalize the direction vector to get a unit vector
		let ux = dx / dist;
		let uy = dy / dist;

		// Calculate the offset vector
		let offset1 = Math.min(w1, h1);
		let offset2 = Math.min(w2, h2);
		let offsetX1 = ux * offset1;
		let offsetY1 = uy * offset1;
		let offsetX2 = ux * offset2;
		let offsetY2 = uy * offset2;

		// Calculate the starting and ending points of the line
		let startX = x1 - offsetX1;
		let startY = y1 - offsetY1;
		let endX = x2 + offsetX2;
		let endY = y2 + offsetY2;

		// Draw the line
		p.stroke("white");
		p.strokeWeight(4);

		p.line(startX, startY, endX, endY);
		// Calculate the angle of the line
		let angle = Math.atan2(endY - startY, endX - startX);

		// Draw the arrowhead
		p.push(); // Save the current drawing style
		p.translate(endX, endY); // Move the origin to the end of the line
		p.rotate(angle - p.HALF_PI); // Rotate the drawing by the angle of the line
		p.triangle(-2, -2, 2, -2, 0, 2); // Draw the arrowhead
		p.pop(); // Restore the previous drawing style
	};

	p.constructTree = function (node, x, y, angle, distance) {
		let numChildren = node.children.length;
		if (node.parent == null) {
			node.x = x;
			node.y = y;
		}
		node.p5Colour = p.color(node.colour.r, node.colour.g, node.colour.b, node.colour.a);
		let deflection = 1;
		let childAngle = 0;
		let startAngle = 0;

		for (let i = 0; i < numChildren; i++) {
			if (node.id === 0) {
				// At the root node, we want the children to be evenly distributed around the parent
				childAngle = angle - Math.PI / 2 + ((i * Math.PI) / numChildren) * 2;
			} else {
				if (numChildren === 1) {
					// the angle out to the next child follows the same angle as the parent
					childAngle = angle;
				} else {
					let angleDiff = Math.min(Math.PI / numChildren, Math.PI);
					// calculate the starting angle so that the children are equally distributed around the parent's angle
					if (numChildren % 2 === 0) {
						// even number of children
						startAngle = angle - angleDiff / 2;
						// calculate the child's angle
						childAngle = startAngle + i * angleDiff;
					} else {
						if (i === 0) {
							childAngle = angle;
						} else {
							startAngle = angle;
							// calculate the child's angle
							let pairNumber = Math.floor((i + 1) / 2);
							childAngle = startAngle + angleDiff * pairNumber * deflection;
							deflection *= -1;
						}
					}
				}
			}

			let childX = x + distance * Math.cos(childAngle);
			let childY = y + distance * Math.sin(childAngle);

			node.children[i].x = childX;
			node.children[i].y = childY;
			node.children[i].distance = distance;

			p.constructTree(node.children[i], childX, childY, childAngle, distance * node.children.length * 0.5);
		}
	};

	p.applyForces = function (nodeArray) {
		var nodes = nodeArray;
		var totalMovement = 0;
		p.translate(p.width / 2, p.height / 2);
		for (let i = 0; i < nodes.length; i++) {
			for (let j = i + 1; j < nodes.length; j++) {
				let dx = nodes[i].x - nodes[j].x;
				let dy = nodes[i].y - nodes[j].y;
				let dist = Math.sqrt(dx * dx + dy * dy);

				// Apply repulsive force
				if (dist < nodes[i].distance) {
					let force = (160 - dist) * 0.05;
					let angle = Math.atan2(dy, dx);
					let moveX = Math.cos(angle) * force;
					let moveY = Math.sin(angle) * force;
					nodes[i].x += moveX;
					nodes[i].y += moveY;
					nodes[j].x -= moveX;
					nodes[j].y -= moveY;

					totalMovement += Math.abs(moveX) + Math.abs(moveY);
				}

				// Check if nodes are not parent-child and are close enough to overlap
				if (
					nodes[i].parent !== nodes[j] &&
					nodes[j].parent !== nodes[i] &&
					dist < nodes[i].width + nodes[j].width
				) {
					// Calculate repulsive force
					let force = (nodes[i].width + nodes[j].width - dist) * 0.05;
					let angle = Math.atan2(dy, dx);
					let moveX = Math.cos(angle) * force;
					let moveY = Math.sin(angle) * force;

					// Apply repulsive force
					nodes[i].x += moveX;
					nodes[i].y += moveY;
					nodes[j].x -= moveX;
					nodes[j].y -= moveY;
				}

				// Apply attractive force
				let minDist = 100;
				if (nodes[i].parent === nodes[j] || nodes[j].parent === nodes[i]) {
					let force = (dist - nodes[i].width) * 0.01;
					if (dist < minDist) {
						// If the nodes are too close
						force = (minDist - dist) * 0.02; // Push them apart
					}
					let angle = Math.atan2(dy, dx);
					let moveX = Math.cos(angle) * force;
					let moveY = Math.sin(angle) * force;
					nodes[i].x -= moveX;
					nodes[i].y -= moveY;
					nodes[j].x += moveX;
					nodes[j].y += moveY;

					totalMovement += Math.abs(moveX) + Math.abs(moveY);
				}
			}
		}

		let averageMovement = totalMovement / nodes.length;
		return { totalMovement, averageMovement };
	};

	p.handleNewData = function (props) {
		if (props.width || props.height) {
			width = props.width;
			height = props.height;
			p.resizeCanvas(width, height);
			origin = p.calculateViewPortCentre();
		}

		if (props.rootNode) {
			rootNode = props.rootNode;
			nodeArray = rootNode.getNodeArray();
		}

		if (props.handleClick) {
			clickHandler = props.handleClick;
		}
	};

	p.mouseClicked = function (event) {
		event.stopPropagation();
		event.preventDefault();

		let selectedNode = p.calculateClick();
		if (selectedNode && clickHandler) {
			clickHandler(selectedNode.selectedNode);
		}
	};

	p.doubleClicked = function (event) {
		event.stopPropagation();
		event.preventDefault();

		let selectedNode = p.calculateClick();
		if (selectedNode) {
			// Update the pan values to center the object
			targetPanX = panX - selectedNode.translatedX;
			targetPanY = panY - selectedNode.translatedY;
			panningAnim = true;
		}
	};

	p.calculateClick = function () {
		var translatedX = p.mouseX - origin.x;
		var translatedY = p.mouseY - origin.y;

		// Iterate over the objects
		let nodeArray = rootNode.getNodeArray();
		let selectedNode = null;
		for (let i = 0; i < nodeArray.length; i++) {
			if (nodeArray[i].mouseHit(translatedX, translatedY, panX, panY, zoom)) {
				selectedNode = nodeArray[i];
				break;
			}
		}
		return { selectedNode, translatedX, translatedY };
	};
}
