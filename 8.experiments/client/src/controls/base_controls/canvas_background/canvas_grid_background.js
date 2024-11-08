const GridWrapperElementId = "canvas-wrapper";
const CellsCanvasContextId = "canvas-grid-cells";
const LinesCanvasContextId = "canvas-grid-lines";

function _getDocumentHeight() {
    return Math.max(
        document.documentElement.clientHeight,
        window.innerHeight || 0
    );
}

function _getDocumentWidth() {
    return Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
}

function _randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

class AnimatedLine {
    constructor(context, left, top, gridHeight) {
        this._context = context;
        this._color = "hsla(180, 100%, 75%, 0.075)";
        this._gridHeight = gridHeight;
        this._height = _randomRange(25, 150);
        this._speed = _randomRange(1, 5);
        this._left = left;
        this._top = top;
        this._width = 1;
    }
    render() {
        this._context.fillStyle = this._color;
        this._context.fillRect(this._left, this._top, this._width, this._height);
    }
    update() {
        this._top -= this._speed;
        if (this._top < -this._gridHeight) {
            this._top = this._gridHeight;
            this._height = _randomRange(25, 150);
            this._speed = _randomRange(1, 5);
        }
        this.render();
    }
}

class Size {
    constructor(width = 0, height = 0) {
        this.width = width;
        this.height = height;
    }
}

class SizeWithRadius extends Size {
    constructor(width = 0, height = 0, radius = 0) {
        super(width, height);
        this.radius = radius;
    }
}

class Background {
    constructor() {
        this._firstRender = true;
        this._animatedLines = [];
        this._gridSize = new Size();
        this._gridSize.height = _getDocumentHeight();
        this._gridSize.width = _getDocumentWidth();
        this._gridCellSize = new SizeWithRadius(30, 30, 2);
    }
    _createAnimatedLines() {
        this._animatedLines = [];
        try {
            for (
                var x = this._gridCellSize.width;
                x <= this._gridSize.width;
                x += this._gridCellSize.width
            ) {
                var y = this._firstRender
                    ? _randomRange(this._gridSize.height * 2, this._gridSize.height * 4)
                    : _randomRange(0, this._gridSize.height * 2);
                this._animatedLines.push(
                    new AnimatedLine(
                        this._linesCanvasContext,
                        x,
                        y,
                        this._gridSize.height
                    )
                );
            }
        } finally {
            this._firstRender = false;
        }
    }
    _drawGridDots() {
        var fillStyle = "hsla(180, 100%, 75%, 0.05)";
        for (
            var x = this._gridCellSize.width;
            x < this._gridSize.width;
            x += this._gridCellSize.width
        ) {
            for (
                var y = this._gridCellSize.height;
                y < this._gridSize.height;
                y += this._gridCellSize.height
            ) {
                this._cellsCanvasContext.beginPath();
                this._cellsCanvasContext.arc(x, y, 1, 0, Math.PI * 2);
                this._cellsCanvasContext.fillStyle = fillStyle;
                this._cellsCanvasContext.fill();
                this._cellsCanvasContext.strokeStyle = fillStyle;
                this._cellsCanvasContext.stroke();
            }
        }
    }
    _drawGridFrame(height, size) {
        if (!this._cellsCanvasElement || !this._cellsCanvasContext) {
            return;
        }
        this._cellsCanvasContext.clearRect(
            0,
            0,
            this._gridSize.width,
            this._gridSize.height
        );
        this._cellsCanvasContext.strokeStyle = "hsla(180, 100%, 75%, 0.05)";
        this._cellsCanvasContext.beginPath();
        this._cellsCanvasContext.setLineDash([]);
        for (var x = 0; x <= this._gridSize.width; x += this._gridCellSize.width) {
            this._cellsCanvasContext.moveTo(x, 0);
            this._cellsCanvasContext.lineTo(x, height);
        }
        this._cellsCanvasContext.stroke();
        this._cellsCanvasContext.beginPath();
        this._cellsCanvasContext.setLineDash([size, size]);
        for (var y = 0; y <= height; y += this._gridCellSize.height) {
            this._cellsCanvasContext.moveTo(0, y);
            this._cellsCanvasContext.lineTo(this._gridSize.width, y);
        }
        this._cellsCanvasContext.stroke();
    }
    _drawGrid() {
        if (!this._cellsCanvasElement || !this._cellsCanvasContext) {
            return;
        }
        this._drawGridFrame(this._gridSize.height, 5);
        this._drawGridDots();
    }
    _onAnimationFrame(sender) {
        if (!sender) {
            return;
        }
        requestAnimationFrame(() => sender._onAnimationFrame(sender));
        sender._linesCanvasContext.clearRect(
            0,
            0,
            sender._gridSize.width,
            sender._gridSize.height
        );
        for (var i = 0; i < sender._animatedLines.length; i++) {
            sender._animatedLines[i].update();
        }
    }
    _onResize(sender) {
        sender._gridSize.width = this._getDocumentWidth();
        sender._gridSize.height = this._getDocumentHeight();
        sender._resizeGrid();
    }
    _resizeGrid() {
        this._cellsCanvasElement.width = this._linesCanvasElement.width = this._gridSize.width;
        this._cellsCanvasElement.height = this._linesCanvasElement.height = this._gridSize.height;
        this._createAnimatedLines();
        this._drawGrid();
    }
    _showAnimated() {
        if (!this._gridWrapperElement) {
            return;
        }
        this._resizeGrid();
        this._gridWrapperElement.animate(
            { opacity: [0, 1] },
            { duration: 2000 }
        ).onfinish = () => {
            this._gridWrapperElement.style.opacity = "1";
        };
        this._drawGrid();
    }
    initialize() {
        this._gridWrapperElement = document.getElementById(GridWrapperElementId);
        if (!this._gridWrapperElement) {
            return;
        }
        this._cellsCanvasElement = document.getElementById(CellsCanvasContextId);
        this._cellsCanvasContext = this._cellsCanvasElement
            ? this._cellsCanvasElement.getContext("2d")
            : undefined;
        this._linesCanvasElement = document.getElementById(LinesCanvasContextId);
        this._linesCanvasContext = this._linesCanvasElement
            ? this._linesCanvasElement.getContext("2d")
            : undefined;
        document.addEventListener("resize", () => this._onResize(this), false);
        this._showAnimated();
        setTimeout(() => this._onAnimationFrame(this), 1500);
    }
}

export default Background;