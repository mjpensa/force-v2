// Wait for the window to load
window.onload = function() {

    // --- DOM Elements ---
    let titleEl, formEl, svg, linesGroup, pointsGroup;

    // --- Animation Parameters ---
    // Set lines and dots to white (#FFFFFF) with transparency
    const pointColor = 'rgba(255, 255, 255, 0.5)'; // White with 50% opacity
    const lineColor = 'rgba(255, 255, 255, 0.4)';  // White with 40% opacity
    const numMilestonesPerSide = 3;
    const pointRadius = 5;
    const zigZagAmount = 80;

    // --- Animation State ---
    let milestones = [];
    let milestoneElements = [];
    let tracerPath;
    let totalPathLength = 0;

    // Animation state for Draw-On / Recede effect
    let animationPhase = "drawing";
    let headPosition = 0;
    let tailPosition = 0;
    const animationSpeed = 2;

    // SVG Namespace for creating elements
    const svgNS = "http://www.w3.org/2000/svg";

    /**
     * Updates all coordinate calculations.
     * Called on init and on window resize.
     */
    function updateDimensions() {
        // Get dimensions of content
        const titleRect = titleEl.getBoundingClientRect();
        const formRect = formEl.getBoundingClientRect();
        const topOffset = titleRect.top + titleRect.height + 20;
        const availableHeight = window.innerHeight - topOffset;

        // Set SVG dimensions
        svg.style.top = `${topOffset}px`;
        svg.style.height = `${availableHeight}px`;
        svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${availableHeight}`);

        const cardLeft = formRect.left;
        const cardRight = formRect.right;
        const gutterLeft = cardLeft * 0.5;
        const gutterRight = cardLeft + (window.innerWidth - cardRight) * 0.5;

        const numTotalMilestones = numMilestonesPerSide * 2;
        const verticalSpacing = availableHeight / (numMilestonesPerSide + 1);

        milestones = [];

        // Add virtual start point
        milestones.push({ x: -200, y: verticalSpacing, length: 0 });

        // Add left-side dots (top to bottom)
        for (let i = 0; i < numMilestonesPerSide; i++) {
            const x = gutterLeft + (Math.random() - 0.5) * zigZagAmount;
            const y = verticalSpacing * (i + 1);
            milestones.push({ x, y, length: 0 });
        }

        // Add right-side dots (BOTTOM to TOP)
        for (let i = 0; i < numMilestonesPerSide; i++) {
            const x = gutterRight + (Math.random() - 0.5) * zigZagAmount;
            const y = verticalSpacing * (numMilestonesPerSide - i);
            milestones.push({ x, y, length: 0 });
        }

        // Add virtual end point
        milestones.push({ x: window.innerWidth + 200, y: verticalSpacing, length: 0 });

        // Path has changed, rebuild it
        buildStaticPath();
    }

    /**
     * Builds the <path> element, dots, and calculates lengths.
     */
    function buildStaticPath() {
        if (milestones.length === 0) return;

        // Clear old elements
        pointsGroup.innerHTML = '';
        milestoneElements = [];

        let d = `M ${milestones[0].x} ${milestones[0].y}`;
        for (let i = 1; i < milestones.length; i++) {
            d += ` L ${milestones[i].x} ${milestones[i].y}`;
        }

        // Use a temporary path to measure lengths
        let tempPath = document.createElementNS(svgNS, 'path');
        tempPath.setAttribute('d', d);
        totalPathLength = tempPath.getTotalLength();

        // Draw static milestone dots and store them
        for (let i = 1; i < milestones.length - 1; i++) { // Skip virtual points
            const dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('cx', milestones[i].x);
            dot.setAttribute('cy', milestones[i].y);
            dot.setAttribute('r', pointRadius);
            dot.setAttribute('fill', pointColor);
            dot.style.opacity = 0; // Start hidden
            dot.style.transition = 'opacity 0.3s ease';
            pointsGroup.appendChild(dot);
            milestoneElements.push(dot);

            // Get length at this dot
            // Create a *new* path segment for measuring
            let measurePath = document.createElementNS(svgNS, 'path');
            let measureD = `M ${milestones[0].x} ${milestones[0].y}`;
            for (let j = 1; j <= i; j++) {
                measureD += ` L ${milestones[j].x} ${milestones[j].y}`;
            }
            measurePath.setAttribute('d', measureD);
            milestones[i].length = measurePath.getTotalLength();
            measurePath = null; // Clean up
        }

        // Set the final path for the visible tracer
        tracerPath.setAttribute('d', d);

        // Clean up the temp path
        tempPath = null;
    }

    /**
     * One-time setup.
     */
    function init() {
        // Create the main <path> element for the line
        tracerPath = document.createElementNS(svgNS, 'path');
        tracerPath.setAttribute('stroke', lineColor);
        tracerPath.setAttribute('stroke-width', '2');
        tracerPath.setAttribute('fill', 'none');
        linesGroup.appendChild(tracerPath);

        // Set initial dimensions and build the path
        updateDimensions();

        // Add resize listener
        window.addEventListener('resize', updateDimensions);
    }

    /**
     * The main animation loop.
     */
    function animate() {
        // Safety check: Don't run if path isn't ready
        if (!tracerPath || !totalPathLength || totalPathLength === 0) {
            requestAnimationFrame(animate); // Wait
            return;
        }

        // --- Draw-On / Recede Animation Logic ---

        if (animationPhase === "drawing") {
            headPosition += animationSpeed;

            const dashLength = headPosition;
            const gapLength = totalPathLength - dashLength;

            if (tracerPath.style) {
                tracerPath.style.strokeDasharray = `${dashLength} ${gapLength}`;
                tracerPath.style.strokeDashoffset = 0;
            }

            if (headPosition >= totalPathLength) {
                headPosition = totalPathLength;
                animationPhase = "receding";
            }

        } else if (animationPhase === "receding") {
            tailPosition += animationSpeed;

            if (tracerPath.style) {
                tracerPath.style.strokeDasharray = `${totalPathLength} ${totalPathLength}`;
                tracerPath.style.strokeDashoffset = -tailPosition;
            }

            if (tailPosition >= totalPathLength) {
                tailPosition = 0;
                headPosition = 0;
                animationPhase = "drawing";
            }
        }

        // UPDATE DOT VISIBILITY
        for (let i = 0; i < milestoneElements.length; i++) {
            // milestone[i+1] because [0] is virtual start
            const dotLength = milestones[i+1].length;
            const dotElement = milestoneElements[i];

            // Safety check: Check elements before styling
            if (dotElement && dotElement.style) {
                const isVisible = (dotLength > tailPosition && dotLength < headPosition);
                dotElement.style.opacity = isVisible ? 1 : 0;
            }
        }

        // Request the next animation frame
        requestAnimationFrame(animate);
    }

    /**
     * Robust Initialization:
     * Waits for key DOM elements to be ready AND RENDERED.
     */
    function retryInit(attemptsLeft = 10) {
        // Find all required elements
        titleEl = document.getElementById('title-block');
        formEl = document.getElementById('gantt-form');
        svg = document.getElementById('roadmap-svg');
        linesGroup = document.getElementById('roadmap-lines');
        pointsGroup = document.getElementById('roadmap-points');

        // Check if all elements were found AND are rendered
        let allElementsReady = false;
        if (titleEl && formEl && svg && linesGroup && pointsGroup) {
            // Now, check if they are rendered
            try {
                const titleRect = titleEl.getBoundingClientRect();
                const formRect = formEl.getBoundingClientRect();
                // Check for valid, non-zero dimensions (or at least that they exist)
                if (titleRect && formRect) {
                    allElementsReady = true;
                }
            } catch (e) {
                // Bounding rect failed, not ready
            }
        }

        if (allElementsReady) {
            // All elements found and rendered, proceed
            console.log("DOM elements are ready, initializing animation.");
            init();
            // Start the animation loop
            animate();
        } else if (attemptsLeft > 0) {
            // Elements not found or not rendered, wait and retry
            console.log("Waiting for DOM elements to render...");
            setTimeout(() => retryInit(attemptsLeft - 1), 200);
        } else {
            // Failed after all attempts
            console.error("Failed to initialize animation: DOM elements not found or not rendered.");
        }
    }

    // Start the initialization check
    retryInit();
};
