import { patternToWords, hashCode } from './utils/libs';
import THEMES from './utils/themes';

const bind = (target, events, fn) =>
	events.forEach(ev => target.addEventListener(ev, fn));
const unbind = (target, events, fn) =>
	events.forEach(ev => target.removeEventListener(ev, fn));

const raf = requestAnimationFrame;

const gcd = (x, y) => {
	while (y != 0) {
		let tmp = x;
		x = y;
		y = tmp % y;
	}
	return x;
}

const createInvalidOptionError = option => new Error(`Need to specify ${option} option`);

const defaultConfig = {
	theme: 'default',
	grid: [ 3, 3 ],
	width: 300,
	height: 430,
};

export class PatternLock {

	constructor(config) {

		if(!config.$canvas) throw createInvalidOptionError('$canvas');

		config = { ...defaultConfig, ...config };

		this.$canvas = config.$canvas;
		this.dimens = { width: config.width, height: config.height };

		this.$canvas.width = this.dimens.width;
		this.$canvas.height = this.dimens.height;

		// Canvas context
		this.ctx = this.$canvas.getContext('2d');


		this._onTouchStart = this._onTouchStart.bind(this);
		this._onTouchStop = this._onTouchStop.bind(this);
		this._onTouchMove = this._onTouchMove.bind(this);
		this._onResize = this._onResize.bind(this);
		this.renderLoop = this.renderLoop.bind(this);
		this.calculationLoop = this.calculationLoop.bind(this);


		this.setTheme(config.theme);

		this._onResize();

		this.setInitialState();
		this.generateGrid(...config.grid);

		this.attachEventHandlers();
	}

	/**
	 * Set the pattern lock screen theme
	 * @param {Object|string}   theme
	 * @return {Object}                  New theme
	 */
	setTheme(theme) {

		const defaultTheme = THEMES.default;

		if(typeof theme === 'string') {
			theme = THEMES[theme];
		}

		this.THEME = this.THEME || {};
		this.THEME.colors = { ...defaultTheme.colors, ...theme.colors };
		this.THEME.dimens = { ...defaultTheme.dimens, ...theme.dimens };

		this.forceUpdate();

		return this.THEME;
	}


	/**
	 * Attach event listeners and start frame loops
	 */
	attachEventHandlers() {
		bind(this.$canvas, ['mousedown','touchstart'], this._onTouchStart);
		bind(this.$canvas, ['mouseup','touchend'], this._onTouchStop);
		bind(window, ['mousemove','touchmove'], this._onTouchMove);
		bind(window, ['resize'], this._onResize);

		// Start frame loops
		raf(this.renderLoop);
		raf(this.calculationLoop);
	}


	/**
	 * Set the initial state
	 */
	setInitialState() {
		this.coordinates = null;
		this.selectedNodes = [];
		this.lastSelectedNode = null;
	}



	set onPatternComplete(cb) {
		this._patternCompleteHandler = cb;
	}

	_onResize() {
		// Canvas position and dimens
		this.bounds = this.$canvas.getBoundingClientRect();
	}

	/**
	 * Mouse start handler
	 */
	_onTouchStart(e) {
		if (e) e.preventDefault();

		this.setInitialState();
		this.calculationLoop(false);
		this.renderLoop(false);

		this._isDragging = true;
	}

	/**
	 * Mouse end handler
	 */
	_onTouchStop(e) {
		if (e) e.preventDefault();

		this.coordinates = null;
		this.renderLoop(false);

		this._isDragging = false;

		if (typeof this._patternCompleteHandler === 'function') {
			this._patternCompleteHandler(this.selectedNodes.slice(0));
		}
	}


	/**
	 * Mouse move handler
	 */
	_onTouchMove(e) {
		if (e) e.preventDefault();

		if (this._isDragging) {

			const mousePoint = {
				x: e.pageX || e.touches[0].pageX,
				y: e.pageY || e.touches[0].pageY,
			};

			mousePoint.x -= this.bounds.left;
			mousePoint.y -= this.bounds.top;

			if (
				mousePoint.x <= this.dimens.width && mousePoint.x > 0 &&
				mousePoint.y <= this.dimens.height && mousePoint.y > 0
			) {
				this.coordinates = mousePoint;
			} else {
				this._onTouchStop();
			}
		}
	}


	/**
	 * Check if the given node is already selected
	 * @param  {Object}  targetNode  Node to check
	 * @return {Boolean}             True if the node is selected
	 */
	isSelected(targetNode) {
		return !!this.selectedNodes.find(
			node => (
				node.row == targetNode.row &&
				node.col == targetNode.col
			)
		);
	}


	/**
	 * Adds intermediary nodes between lastSelectedNode to a targetNode
	 *
	 * @param  {Object}  targetNode  Node to select
	 */
	addIntermediaryNodes(targetNode) {
		const stepNode = this.intermediaryNodesStep(targetNode);
		if (stepNode.row !== 0 || stepNode.col !== 0) {
			let currentNode = { row: this.lastSelectedNode.row + stepNode.row, col: this.lastSelectedNode.col + stepNode.col };
			const maxIterations = Math.max(this.rows, this.cols);
			let i = 0;
			while (i++ < maxIterations && (currentNode.row !== targetNode.row || currentNode.col !== targetNode.col)) {
				this.selectedNodes.push(currentNode);
				currentNode = { row: currentNode.row + stepNode.row, col: currentNode.col + stepNode.col };
			}
		}
		this.lastSelectedNode = targetNode;
	}


	/**
	 * Returns the steps to perform to select intermediary nodes between lastSelectedNode and a targetNode
	 *
	 * @param  {Object}  targetNode  Node to select
	 *
	 * @return {Object}             { row: stepForRows, col: StepForCols }
	 */
	intermediaryNodesStep(targetNode) {
		let finalStep = { row: 0, col: 0 };
		if (!this.lastSelectedNode) {
			return finalStep;
		}

		const dRow = Math.abs(this.lastSelectedNode.row - targetNode.row);
		const dCol = Math.abs(this.lastSelectedNode.col - targetNode.col);

		if (dRow === 1 || dCol === 1) {
			return finalStep;
		}

		let dRsign = (this.lastSelectedNode.row - targetNode.row) < 0 ? 1 : -1;
		let dCsign = (this.lastSelectedNode.col - targetNode.col) < 0 ? 1 : -1;

		if (dRow === 0) {
			if (dCol !== 0) finalStep.col = dCsign;
		} else if (dCol === 0) {
			finalStep.row = dRsign;
		} else {
			const max = Math.max(dRow, dCol);
			const min = Math.min(dRow, dCol);
			const gcd = this.gcd(max, min);
			if (max % min === 0) {
				finalStep.col = (dCol / gcd) * dCsign;
				finalStep.row = (dRow / gcd) * dRsign;
			}
		}
		return finalStep;
	}


	/**
	 * Calculate the state of the lock for the next frame
	 *
	 * @param  {Boolean} runLoop  Start it as a loop if true
	 */
	calculationLoop(runLoop = true) {

		if (this._isDragging && this.coordinates) {

			this.forEachNode((x, y) => {

				const dist = Math.sqrt(
					Math.pow(this.coordinates.x - x, 2) +
					Math.pow(this.coordinates.y - y, 2)
				);

				if (dist < this.THEME.dimens.node_radius + 1) {

					const row = x / this.interval.x;
					const col = y / this.interval.y;

					const currentNode = { row, col };

					if (!this.isSelected(currentNode)) {
						this.addIntermediaryNodes(currentNode);
						this.selectedNodes.push(currentNode);
						return false;
					}
				}
			});
		}

		if (runLoop) {
			raf(this.calculationLoop);
		}
	}

	forceUpdate() {
		raf(() => {
			this._isDragging = true;
			this.calculationLoop(false);
			raf(() => this.renderLoop(false));
			this._isDragging = false;
		});
	}

	/**
	 * Render the state of the lock
	 *
	 * @param  {Boolean} runLoop  Start it as a loop if true
	 */
	renderLoop(runLoop = true) {

		if (this._isDragging) {
			const { accent, primary } = this.THEME.colors;

			// Clear the canvas(Redundant)
			this.ctx.clearRect(0, 0, this.dimens.width, this.dimens.height);

			this.renderGrid();

			// Plot all the selected nodes
			const lastNode = this.selectedNodes.reduce((prevNode, node) => {
				if (prevNode) {

					const point1 = { x: node.row * this.interval.x, y: node.col * this.interval.y };
					const point2 = { x: prevNode.row * this.interval.x, y: prevNode.col * this.interval.y };

					// Make the two selected nodes bigger
					this.drawNode(
						point1.x, point1.y,
						accent, primary,
						this.THEME.dimens.node_ring + 3
					);
					this.drawNode(
						point2.x, point2.y,
						accent, primary,
						this.THEME.dimens.node_ring + 3
					);

					// Join the nodes
					this.joinNodes(
						prevNode.row, prevNode.col,
						node.row, node.col
					);
				}

				return node;
			}, null);


			if (lastNode && this.coordinates) {

				// Draw the last node
				this.drawNode(
					lastNode.row * this.interval.x, lastNode.col * this.interval.y,
					accent, primary,
					this.THEME.dimens.node_ring + 6
				);

				// Draw a line between last node to the current drag position
				this.joinNodes(
					lastNode.row * this.interval.x, lastNode.col * this.interval.y,
					this.coordinates.x, this.coordinates.y,
					true  // IsCoordinates instead of row and column position
				);
			}
		}

		if (runLoop) {
			raf(this.renderLoop);
		}
	}



	/**
	 * Generate the grid of nodes
	 *
	 * @param  {Number} rows  The number of horizontal nodes
	 * @param  {Number} cols  The number of vertical nodes
	 */
	generateGrid(rows, cols) {

		this.rows = rows;
		this.cols = cols;

		this.renderGrid();
	}


	/**
	 * Render the grid to the canvas
	 */
	renderGrid() {

		this.ctx.fillStyle = this.THEME.colors.bg;
		this.ctx.fillRect(0, 0, this.dimens.width, this.dimens.height);

		this.interval = {
			x: this.dimens.width / (this.rows + 1),
			y: this.dimens.height / (this.cols + 1),
		};

		// Draw all the nodes
		this.forEachNode(this.drawNode.bind(this));
	}



	/**
	 * ForEach iterator for all nodes on the grid
	 *
	 * @param  {Function} callback
	 */
	forEachNode(callback) {

		const xGrid = Array(this.rows).fill(this.interval.x);
		const yGrid = Array(this.cols).fill(this.interval.y);

		const breakException = new Error('Break Exception');

		try {

			yGrid.reduce((y, dy) => {

				xGrid.reduce((x, dx) => {

					// If the callback returns false, break out of the loop
					if (callback(x, y) === false)
						throw breakException;

					return x + dx;

				}, this.interval.x);

				return y + dy;

			}, this.interval.y);

		} catch (e) {
			if (e !== breakException) throw e;
		}
	}


	/**
	 * Draw a node
	 *
	 * @param  {Number} x
	 * @param  {Number} y
	 * @param  {String} centerColor
	 * @param  {String} borderColor
	 * @param  {Number} size
	 */
	drawNode(x, y, centerColor = this.THEME.colors.primary, borderColor = this.THEME.colors.primary, size = this.THEME.dimens.node_ring) {

		// Config
		this.ctx.lineWidth = size;
		this.ctx.fillStyle = centerColor;
		this.ctx.strokeStyle = borderColor;

		// Draw inner circle
		this.ctx.beginPath();
		this.ctx.arc(x, y, this.THEME.dimens.node_core, 0, Math.PI * 2);
		this.ctx.fill();

		// Draw outer ring
		this.ctx.beginPath();
		this.ctx.arc(x, y, this.THEME.dimens.node_radius, 0, Math.PI * 2);
		this.ctx.stroke();
	}


	/**
	 * Join two nodes with a line
	 *
	 * @param  {Number}  row1
	 * @param  {Number}  col1
	 * @param  {Number}  row2
	 * @param  {Number}  col2
	 * @param  {Boolean} isCoordinates  If true, will calculate as pixels
	 */
	joinNodes(row1, col1, row2, col2, isCoordinates = false) {

		let factor = this.interval;

		if (isCoordinates) {
			factor = { x: 1, y: 1 };
		}

		const point1 = { x: factor.x * row1, y: factor.y * col1 };
		const point2 = { x: factor.x * row2, y: factor.y * col2 };

		// Config
		this.ctx.lineWidth = this.THEME.dimens.line_width;
		this.ctx.strokeStyle = this.THEME.colors.accent;
		this.ctx.lineCap = 'round';

		// Draw line
		this.ctx.beginPath();
		this.ctx.moveTo(point1.x, point1.y);
		this.ctx.lineTo(point2.x, point2.y);
		this.ctx.stroke();
	}
}

export default (...args) => new PatternLock(...args);
