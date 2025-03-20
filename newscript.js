let scene, camera, renderer, sphere, textureLoader, audioPlayer;
let hotspots = [], labels = [];
let config, currentRoom;
let roomSizeElement, loadingOverlay, controlsHelp;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraRotation = { x: 0, y: 0 };
let transitionInProgress = false;
let isMuted = false;
let minimap;
let autoRotate = false;
let autoRotateSpeed = 0.001;
let pinchStartDistance = 0;
let currentZoom = 1;
let clock = new THREE.Clock();

// Load configuration dynamically
fetch("flat_config.json")
    .then(response => response.json())
    .then(data => {
        config = data;
        init();
        createUI();
        loadRoom("living_room");  // Start in the living room
    })
    .catch(error => {
        console.error("Error loading configuration:", error);
        showErrorMessage("Failed to load tour data. Please try again later.");
    });

function init() {
    // Create loading overlay
    loadingOverlay = document.createElement("div");
    loadingOverlay.className = "loading-overlay";
    loadingOverlay.innerHTML = "<div class='spinner'></div><p>Loading luxury experience...</p>";
    document.body.appendChild(loadingOverlay);

    // Initialize Three.js scene
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    // Create 360° sphere
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    const material = new THREE.MeshBasicMaterial({ 
        side: THREE.DoubleSide,
        color: 0xffffff
    });
    sphere = new THREE.Mesh(geometry, material);
    sphere.scale.x = -1; // Invert to make it viewable from inside
    scene.add(sphere);

    // Audio Player for Voiceovers
    audioPlayer = new Audio();
    audioPlayer.volume = 0.7;

    // Setup event listeners
    setupEventListeners();
    
    // Setup device orientation for mobile
    setupDeviceOrientation();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
}

function setupEventListeners() {
    // Mouse events
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    // Touch events
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    
    // Wheel event for zoom
    document.addEventListener('wheel', onWheel);
    
    // Keyboard controls
    document.addEventListener('keydown', onKeyDown);
}

function setupDeviceOrientation() {
    if (window.DeviceOrientationEvent) {
        // Create UI toggle for device orientation
        const orientationToggle = document.createElement("button");
        orientationToggle.className = "orientation-toggle";
        orientationToggle.innerHTML = "📱 Enable Motion Controls";
        document.body.appendChild(orientationToggle);
        
        let deviceOrientationEnabled = false;
        let initialAlpha = null;
        let initialBeta = null;
        let initialGamma = null;
        
        orientationToggle.addEventListener('click', function() {
            if (!deviceOrientationEnabled) {
                // Request permission for iOS devices
                if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                    DeviceOrientationEvent.requestPermission()
                        .then(permissionState => {
                            if (permissionState === 'granted') {
                                enableDeviceOrientation();
                                orientationToggle.innerHTML = "📱 Disable Motion Controls";
                                deviceOrientationEnabled = true;
                                document.body.classList.add('orientation-enabled');
                            }
                        })
                        .catch(console.error);
                } else {
                    // Non-iOS devices
                    enableDeviceOrientation();
                    orientationToggle.innerHTML = "📱 Disable Motion Controls";
                    deviceOrientationEnabled = true;
                    document.body.classList.add('orientation-enabled');
                }
            } else {
                // Disable device orientation
                window.removeEventListener('deviceorientation', handleDeviceOrientation);
                orientationToggle.innerHTML = "📱 Enable Motion Controls";
                deviceOrientationEnabled = false;
                document.body.classList.remove('orientation-enabled');
            }
        });
        
        function enableDeviceOrientation() {
            window.addEventListener('deviceorientation', handleDeviceOrientation);
            
            // Show brief instructions
            const instructionElement = document.createElement("div");
            instructionElement.className = "orientation-instructions";
            instructionElement.textContent = "Move your phone to look around";
            document.body.appendChild(instructionElement);
            
            setTimeout(() => {
                instructionElement.style.opacity = "0";
                setTimeout(() => {
                    document.body.removeChild(instructionElement);
                }, 1000);
            }, 3000);
        }
        
        function handleDeviceOrientation(event) {
            if (!deviceOrientationEnabled) return;
            
            // Initialize reference orientation on first reading
            if (initialAlpha === null) {
                initialAlpha = event.alpha;
                initialBeta = event.beta;
                initialGamma = event.gamma;
                return;
            }
            
            // Calculate rotation differences
            const deltaAlpha = (event.alpha - initialAlpha) * Math.PI / 180;
            const deltaBeta = (event.beta - initialBeta) * Math.PI / 180;
            
            // Apply rotation to camera
            camera.rotation.y = -deltaAlpha * 0.5;
            camera.rotation.x = deltaBeta * 0.5;
            
            // Update the rotation values for tracking
            cameraRotation.x = camera.rotation.x;
            cameraRotation.y = camera.rotation.y;
        }
        
        // Reset button to recalibrate orientation
        const resetButton = document.createElement("button");
        resetButton.className = "reset-orientation";
        resetButton.innerHTML = "↻ Reset View";
        document.body.appendChild(resetButton);
        
        resetButton.addEventListener('click', function() {
            // Reset camera rotation
            camera.rotation.set(0, 0, 0);
            cameraRotation = { x: 0, y: 0 };
            
            // Reset orientation reference
            initialAlpha = null;
            initialBeta = null;
            initialGamma = null;
        });
    } else {
        console.log("Device orientation not supported");
    }
}

function createUI() {
    // Header with logo and mute button
    const header = document.createElement("div");
    header.id = "header";
    header.innerHTML = `
        <div class="logo">Luxury 5BHK Tour</div>
        <div class="controls">
            <button id="autoRotateButton" title="Auto Rotate">🔄</button>
            <button id="muteButton" title="Mute/Unmute">🔊</button>
            <button id="fullscreenButton" title="Fullscreen">⛶</button>
            <button id="helpButton" title="Help">❓</button>
        </div>
    `;
    document.body.appendChild(header);
    
    // Room Size Floating Text
    roomSizeElement = document.createElement("div");
    roomSizeElement.className = "room-size";
    document.body.appendChild(roomSizeElement);

    // Navigation Menu
    const navMenu = document.createElement("div");
    navMenu.className = "nav-menu";
    document.body.appendChild(navMenu);

    // Create menu items for each room
    Object.keys(config.rooms).forEach(roomName => {
        const menuItem = document.createElement("button");
        menuItem.className = "menu-item";
        menuItem.textContent = roomName.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());
        menuItem.onclick = () => {
            if (!transitionInProgress) {
                transitionToRoom(roomName);
            }
        };
        navMenu.appendChild(menuItem);
    });

    // Mini map
    createMinimap();

    // Controls help
    controlsHelp = document.createElement("div");
    controlsHelp.className = "controls-help";
    controlsHelp.innerHTML = "Click and drag to look around";
    document.body.appendChild(controlsHelp);
    
    // Hide controls help after 5 seconds
    setTimeout(() => {
        controlsHelp.style.opacity = "0";
    }, 5000);
    
    // Button event listeners
    document.getElementById("muteButton").addEventListener("click", toggleMute);
    document.getElementById("fullscreenButton").addEventListener("click", toggleFullscreen);
    document.getElementById("autoRotateButton").addEventListener("click", toggleAutoRotate);
    document.getElementById("helpButton").addEventListener("click", showHelp);
}

function createMinimap() {
    minimap = document.createElement("div");
    minimap.className = "minimap";
    minimap.innerHTML = `
        <div class="minimap-header">
            <span>Floor Plan</span>
            <button class="minimap-toggle">−</button>
        </div>
        <div class="minimap-content">
            <div class="floor-plan">
                <!-- Simple SVG floor plan -->
                <svg viewBox="0 0 300 200" width="100%" height="100%">
                    <!-- Living Room -->
                    <rect x="50" y="50" width="100" height="100" fill="#e0e0e0" stroke="#333" />
                    <text x="100" y="100" text-anchor="middle" font-size="10">Living Room</text>
                    
                    <!-- Kitchen -->
                    <rect x="150" y="50" width="80" height="60" fill="#e0e0e0" stroke="#333" />
                    <text x="190" y="80" text-anchor="middle" font-size="10">Kitchen</text>
                    
                    <!-- Master Bedroom -->
                    <rect x="150" y="110" width="100" height="80" fill="#e0e0e0" stroke="#333" />
                    <text x="200" y="150" text-anchor="middle" font-size="10">Master Bedroom</text>
                    
                    <!-- Current position marker -->
                    <circle id="position-marker" cx="100" cy="100" r="5" fill="red" />
                </svg>
            </div>
        </div>
    `;
    document.body.appendChild(minimap);
    
    // Minimap toggle functionality
    const minimapToggle = minimap.querySelector(".minimap-toggle");
    const minimapContent = minimap.querySelector(".minimap-content");
    
    minimapToggle.addEventListener("click", () => {
        if (minimapContent.style.display === "none") {
            minimapContent.style.display = "block";
            minimapToggle.textContent = "−";
        } else {
            minimapContent.style.display = "none";
            minimapToggle.textContent = "+";
        }
    });
}

function updateMinimap(roomName) {
    const marker = document.getElementById("position-marker");
    
    // Set marker position based on current room
    switch(roomName) {
        case "living_room":
            marker.setAttribute("cx", "100");
            marker.setAttribute("cy", "100");
            break;
        case "kitchen":
            marker.setAttribute("cx", "190");
            marker.setAttribute("cy", "80");
            break;
        case "master_bedroom":
            marker.setAttribute("cx", "200");
            marker.setAttribute("cy", "150");
            break;
    }
}

// Load a room dynamically from the JSON config
function loadRoom(roomName) {
    if (!config.rooms[roomName]) return;

    currentRoom = config.rooms[roomName];
    
    // Show loading overlay
    loadingOverlay.style.display = "flex";

    // Load the new 360° image
    textureLoader.load(
        currentRoom.image,
        (texture) => {
            sphere.material.map = texture;
            sphere.material.needsUpdate = true;
            loadingOverlay.style.display = "none";
            
            // Update active menu item
            document.querySelectorAll('.menu-item').forEach(item => {
                item.classList.remove('active');
                if (item.textContent.toLowerCase() === roomName.replace("_", " ")) {
                    item.classList.add('active');
                }
            });

            // Play voiceover if available and not muted
            if (currentRoom.voiceover && !isMuted) {
                audioPlayer.src = currentRoom.voiceover;
                audioPlayer.play();
            }

            // Show room size animation
            showRoomSizeAnimation(currentRoom.room_size);

            // Clear previous hotspots & labels
            hotspots.forEach(hotspot => document.body.removeChild(hotspot.element));
            labels.forEach(label => document.body.removeChild(label.element));
            hotspots = [];
            labels = [];

            // Add hotspots
            currentRoom.hotspots.forEach(hotspot => {
                addHotspot(hotspot.text, hotspot.x, hotspot.y, hotspot.z, hotspot.target);
            });

            // Add labels
            currentRoom.labels.forEach(label => {
                addLabel(label.text, label.x, label.y, label.z);
            });
            
            // Update minimap
            updateMinimap(roomName);
            
            transitionInProgress = false;
        },
        undefined,
        (error) => {
            console.error("Error loading texture:", error);
            loadingOverlay.style.display = "none";
            showErrorMessage("Failed to load room image");
            transitionInProgress = false;
        }
    );
}

function transitionToRoom(roomName) {
    transitionInProgress = true;
    
    // Stop auto rotation during transition
    const wasAutoRotating = autoRotate;
    autoRotate = false;
    
    // Fade out current view
    const fadeOverlay = document.createElement("div");
    fadeOverlay.className = "fade-overlay";
    document.body.appendChild(fadeOverlay);
    
    gsap.to(fadeOverlay, { 
        opacity: 1, 
        duration: 0.8, 
        onComplete: () => {
            loadRoom(roomName);
            gsap.to(fadeOverlay, { 
                opacity: 0, 
                duration: 0.8,
                onComplete: () => {
                    document.body.removeChild(fadeOverlay);
                    // Restore auto rotation if it was enabled
                    autoRotate = wasAutoRotating;
                }
            });
        }
    });
}

// Show animated room size text
function showRoomSizeAnimation(roomSizeText) {
    roomSizeElement.innerHTML = roomSizeText;
    gsap.to(roomSizeElement, { opacity: 1, 
        duration: 1, 
        onComplete: () => {
            gsap.to(roomSizeElement, { 
                opacity: 0, 
                duration: 1,
                delay: 3
            });
        }
    });
    }
    
    // Add a hotspot to navigate to another room
    function addHotspot(text, x, y, z, target) {
        const hotspotElement = document.createElement("div");
        hotspotElement.className = "hotspot";
        hotspotElement.innerHTML = `<span class="hotspot-dot"></span><div class="hotspot-text">${text}</div>`;
        document.body.appendChild(hotspotElement);
    
        const position = new THREE.Vector3(x, y, z);
        
        // Add pulse animation
        const pulseElement = document.createElement("div");
        pulseElement.className = "pulse";
        hotspotElement.appendChild(pulseElement);
        
        hotspotElement.addEventListener("click", () => {
            if (!transitionInProgress) {
                transitionToRoom(target);
            }
        });
    
        hotspots.push({
            element: hotspotElement,
            position: position
        });
    }
    
    // Add informational label
    function addLabel(text, x, y, z) {
        const labelElement = document.createElement("div");
        labelElement.className = "info-label";
        labelElement.textContent = text;
        document.body.appendChild(labelElement);
    
        const position = new THREE.Vector3(x, y, z);
        
        labels.push({
            element: labelElement,
            position: position
        });
    }
    
    // Update position of all hotspots and labels
    function updateHotspotPositions() {
        hotspots.forEach(hotspot => {
            const screenPosition = hotspot.position.clone()
                .project(camera);
            
            const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
            const y = (screenPosition.y * -0.5 + 0.5) * window.innerHeight;
            const z = screenPosition.z;
            
            hotspot.element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
            
            // Hide hotspot if behind the camera
            if (z > 1) {
                hotspot.element.style.display = "none";
            } else {
                hotspot.element.style.display = "block";
            }
        });
        
        labels.forEach(label => {
            const screenPosition = label.position.clone()
                .project(camera);
            
            const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
            const y = (screenPosition.y * -0.5 + 0.5) * window.innerHeight;
            const z = screenPosition.z;
            
            label.element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
            
            // Hide label if behind the camera
            if (z > 1) {
                label.element.style.display = "none";
            } else {
                label.element.style.display = "block";
            }
        });
    }
    
    // Mouse event handlers
    function onMouseDown(event) {
        event.preventDefault();
        isDragging = true;
        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
    
    function onMouseMove(event) {
        if (isDragging) {
            const deltaMove = {
                x: event.clientX - previousMousePosition.x,
                y: event.clientY - previousMousePosition.y
            };
    
            const rotationSpeed = 0.003;
            cameraRotation.y += deltaMove.x * rotationSpeed;
            cameraRotation.x += deltaMove.y * rotationSpeed;
    
            // Limit vertical rotation
            cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraRotation.x));
    
            camera.rotation.set(cameraRotation.x, cameraRotation.y, 0, 'YXZ');
    
            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        }
    }
    
    function onMouseUp(event) {
        isDragging = false;
    }
    
    // Touch event handlers
    function onTouchStart(event) {
        event.preventDefault();
        
        if (event.touches.length === 1) {
            // Single touch - look around
            isDragging = true;
            previousMousePosition = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            };
        } else if (event.touches.length === 2) {
            // Two touches - pinch to zoom
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            pinchStartDistance = Math.hypot(
                touch1.clientX - touch2.clientX,
                touch1.clientY - touch2.clientY
            );
        }
    }
    
    function onTouchMove(event) {
        event.preventDefault();
        
        if (isDragging && event.touches.length === 1) {
            // Single touch - look around
            const deltaMove = {
                x: event.touches[0].clientX - previousMousePosition.x,
                y: event.touches[0].clientY - previousMousePosition.y
            };
    
            const rotationSpeed = 0.003;
            cameraRotation.y += deltaMove.x * rotationSpeed;
            cameraRotation.x += deltaMove.y * rotationSpeed;
    
            // Limit vertical rotation
            cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraRotation.x));
    
            camera.rotation.set(cameraRotation.x, cameraRotation.y, 0, 'YXZ');
    
            previousMousePosition = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            };
        } else if (event.touches.length === 2) {
            // Two touches - pinch to zoom
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const currentDistance = Math.hypot(
                touch1.clientX - touch2.clientX,
                touch1.clientY - touch2.clientY
            );
            
            // Calculate zoom factor
            if (pinchStartDistance > 0) {
                const zoomFactor = currentDistance / pinchStartDistance;
                handleZoom(zoomFactor);
                pinchStartDistance = currentDistance;
            }
        }
    }
    
    function onTouchEnd(event) {
        if (event.touches.length === 0) {
            isDragging = false;
        }
    }
    
    // Wheel event for zooming
    function onWheel(event) {
        event.preventDefault();
        
        const zoomFactor = event.deltaY > 0 ? 0.95 : 1.05;
        handleZoom(zoomFactor);
    }
    
    function handleZoom(zoomFactor) {
        // Adjust field of view (FOV) for zoom effect
        const minFOV = 30;
        const maxFOV = 90;
        const newFOV = camera.fov / zoomFactor;
        
        if (newFOV >= minFOV && newFOV <= maxFOV) {
            camera.fov = newFOV;
            camera.updateProjectionMatrix();
            currentZoom = currentZoom * zoomFactor;
        }
    }
    
    // Keyboard controls
    function onKeyDown(event) {
        const keyCode = event.keyCode;
        
        switch(keyCode) {
            case 37: // Left arrow
                cameraRotation.y += 0.1;
                camera.rotation.set(cameraRotation.x, cameraRotation.y, 0, 'YXZ');
                break;
            case 39: // Right arrow
                cameraRotation.y -= 0.1;
                camera.rotation.set(cameraRotation.x, cameraRotation.y, 0, 'YXZ');
                break;
            case 38: // Up arrow
                cameraRotation.x += 0.1;
                cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraRotation.x));
                camera.rotation.set(cameraRotation.x, cameraRotation.y, 0, 'YXZ');
                break;
            case 40: // Down arrow
                cameraRotation.x -= 0.1;
                cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraRotation.x));
                camera.rotation.set(cameraRotation.x, cameraRotation.y, 0, 'YXZ');
                break;
            case 27: // Escape key
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                }
                break;
        }
    }
    
    // Window resize handler
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // Toggle mute/unmute audio
    function toggleMute() {
        isMuted = !isMuted;
        audioPlayer.muted = isMuted;
        
        const muteButton = document.getElementById("muteButton");
        muteButton.textContent = isMuted ? "🔇" : "🔊";
    }
    
    // Toggle fullscreen mode
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
                .catch(err => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                });
        } else {
            document.exitFullscreen();
        }
    }
    
    // Toggle auto rotation
    function toggleAutoRotate() {
        autoRotate = !autoRotate;
        
        const autoRotateButton = document.getElementById("autoRotateButton");
        autoRotateButton.classList.toggle("active", autoRotate);
    }
    
    // Show help dialog
    function showHelp() {
        const helpDialog = document.createElement("div");
        helpDialog.className = "help-dialog";
        helpDialog.innerHTML = `
            <div class="help-content">
                <h2>How to use this tour</h2>
                <ul>
                    <li><strong>Look around:</strong> Click and drag or use arrow keys</li>
                    <li><strong>Zoom:</strong> Mouse wheel or pinch gesture</li>
                    <li><strong>Navigate:</strong> Click on hotspots (pulsing dots) or use the room menu</li>
                    <li><strong>Fullscreen:</strong> Click the fullscreen button</li>
                    <li><strong>Mobile:</strong> Use the motion controls option for immersive viewing</li>
                </ul>
                <button class="close-help">Close</button>
            </div>
        `;
        document.body.appendChild(helpDialog);
        
        const closeButton = helpDialog.querySelector(".close-help");
        closeButton.addEventListener("click", () => {
            document.body.removeChild(helpDialog);
        });
    }
    
    // Show error message
    function showErrorMessage(message) {
        const errorDialog = document.createElement("div");
        errorDialog.className = "error-dialog";
        errorDialog.innerHTML = `
            <div class="error-content">
                <h2>Error</h2>
                <p>${message}</p>
                <button class="close-error">Close</button>
            </div>
        `;
        document.body.appendChild(errorDialog);
        
        const closeButton = errorDialog.querySelector(".close-error");
        closeButton.addEventListener("click", () => {
            document.body.removeChild(errorDialog);
        });
    }
    
    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        
        if (autoRotate) {
            cameraRotation.y += autoRotateSpeed;
            camera.rotation.set(cameraRotation.x, cameraRotation.y, 0, 'YXZ');
        }
        
        updateHotspotPositions();
        renderer.render(scene, camera);
    }