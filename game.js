/**
 * Flappy Bird Game with Open Game Protocol Integration
 */

// Game Configuration
const CONFIG = {
    gameId: '08a17f31-977f-4404-aa47-32d986e66419',
    testLoggedInPlayerId: '',
    gravity: 0.05,
    flapStrength: 3,
    maxVelocity: 5,
    birdInitialY: 300,
    birdWidth: 30,
    birdHeight: 30,
    birdX: 50,
    obstacleWidth: 50,
    obstacleSpeed: 2,
    gapSize: 150,
    canvasWidth: 400,
    canvasHeight: 600,
    birdColor: '#FFD700',
    beakColor: '#FF8C00',
    wingColor: 'white',
    obstacleColor: '#228B22',
    animationFrameInterval: 10,
    rotationFriction: 0.4,
    rotationSensitivity: 0.3,
    maxRotation: Math.PI / 4,
};

// Game Element References
const DOM = {
    canvas: document.getElementById('gameCanvas'),
    startScreen: document.getElementById('startScreen'),
    gameOverScreen: document.getElementById('gameOverScreen'),
    startButton: document.getElementById('startButton'),
    playAgainButton: document.getElementById('playAgainButton'),
    roundScore: document.getElementById('roundScore'),
};

// Game State
const gameState = {
    ctx: DOM.canvas.getContext('2d'),
    birdY: CONFIG.birdInitialY,
    birdVelocity: 0,
    birdRotation: 0, // Current rotation angle
    birdRotationVelocity: 0, // Rate of rotation change
    obstacleX: CONFIG.canvasWidth,
    gap: CONFIG.gapSize,
    obstacleHeight: 0,
    score: 0,
    ogpPoints: 0,
    gameRunning: false,
    animationFrameId: null,
    animationFrame: 0,
    animationCounter: 0
};

// OGP Integration
class OGPManager {
    constructor() {
        this.ogp = null;
        this.isInitialized = false;
        this.initialize();
    }

    initialize() {
        try {
            console.log('Initializing OGP SDK...');
            this.ogp = new OpenGameSDK({
                ui: {
                  usePointsWidget: true,
                }
              });

            this.ogp.init({ gameId: CONFIG.gameId, playerId: CONFIG.testLoggedInPlayerId})
                .then(() => {
                    console.log('OGP SDK initialized successfully');
                    this.isInitialized = true;
                    this.setupListeners();
                })
                .catch(error => {
                    console.error('Failed to initialize OGP SDK:', error);
                    this.handleInitError();
                });
            
            this.ogp.gameReadyToPlay();
        } catch (error) {
            console.error('Error initializing OGP:', error);
            this.handleInitError();
        }
    }

    setupListeners() {
        this.ogp.on('OnReady', () => {
            console.log('OGP SDK is ready');
            DOM.startScreen.style.display = 'block';
        });
    }

    handleInitError() {
        DOM.startScreen.style.display = 'block';
    }

    addPoints(points) {
       console.log('Adding points:', points);
       this.ogp.ui.addPoints(points);
    }                                                                                       

    saveScore(points) {
        if (!this.isInitialized || points <= 0) return Promise.resolve();

        return this.ogp.savePoints(points)
            .then(response => {
                console.log('Points saved:', response);
            })
            .catch(error => {
                console.error('Failed to save points:', error);
                return Promise.reject(error);
            });
    }
}

// Game Logic
class FlappyBirdGame {
    constructor(ogpManager) {
        this.ogpManager = ogpManager;
        this.setupEventListeners();
        this.resetObstacle();
    }

    setupEventListeners() {
        DOM.startButton.addEventListener('click', () => this.startGame());
        DOM.playAgainButton.addEventListener('click', () => this.startGame());
        DOM.canvas.addEventListener('click', () => this.flap());
        DOM.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.flap();
        });
        
        // Add keyboard support
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
                this.flap();
            }
        });
    }

    startGame() {
        DOM.startScreen.style.display = 'none';
        DOM.gameOverScreen.style.display = 'none';
        
        gameState.birdY = CONFIG.birdInitialY;
        gameState.birdVelocity = 0;
        gameState.birdRotation = 0;
        gameState.birdRotationVelocity = 0;
        gameState.obstacleX = CONFIG.canvasWidth;
        gameState.score = 0;
        gameState.gameRunning = true;
        gameState.animationFrame = 0;
        gameState.animationCounter = 0;
        
        this.resetObstacle();
        this.gameLoop();
    }

    gameLoop() {
        if (!gameState.gameRunning) return;
        
        this.update();
        this.render();
        
        gameState.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        this.updateBirdPosition();
        this.updateBirdRotation();
        this.updateObstaclePosition();
        this.updateObstaclePassed();
        this.updateAnimation();
        this.checkCollisions();
    }

    updateBirdPosition() {
        gameState.birdVelocity = Math.min(gameState.birdVelocity + CONFIG.gravity, CONFIG.maxVelocity);
        gameState.birdY += gameState.birdVelocity;
    }

    updateBirdRotation() {
        // Calculate target rotation based on velocity
        const targetRotation = Math.max(-CONFIG.maxRotation, Math.min(CONFIG.maxRotation, gameState.birdVelocity * CONFIG.rotationSensitivity));
        
        // Calculate rotation velocity towards target
        const rotationDifference = targetRotation - gameState.birdRotation;
        gameState.birdRotationVelocity += rotationDifference * 0.1; // Spring force towards target
        
        // Apply friction to rotation velocity
        gameState.birdRotationVelocity *= CONFIG.rotationFriction;
        
        // Update rotation
        gameState.birdRotation += gameState.birdRotationVelocity;
    }

    updateObstaclePosition() {
        gameState.obstacleX -= CONFIG.obstacleSpeed;
    }

    updateObstaclePassed() {
        if (gameState.obstacleX < -CONFIG.obstacleWidth) {
            this.resetObstacle();
            gameState.score++;
            this.ogpManager.addPoints(1);
        }
    }

    updateAnimation() {
        gameState.animationCounter++;
        if (gameState.animationCounter >= CONFIG.animationFrameInterval) { // Change frame every 10 updates
            this.updateAnimationFrame();
        }
    }

    updateAnimationFrame() {
        // Only flap wings when bird is not angled downward (gliding)
        // When bird is angled downward (positive rotation), keep wings straight
        if (gameState.birdRotation > 0) {
            // Bird is angled downward - keep wings in gliding position (frame 0)
            gameState.animationFrame = 0;
        } else {
            // Bird is level or angled upward - normal wing flapping
            gameState.animationFrame = gameState.animationFrame === 0 ? 1 : 0;
        }
        gameState.animationCounter = 0;
    }

    render() {
        this.drawBird();
        this.drawObstacle();    
    }

    drawBird() {
        const { ctx } = gameState;
        
        // Clear canvas
        ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

        // Use smooth rotation from physics simulation
        const rotationAngle = gameState.birdRotation;
        
        // Bird center coordinates
        const birdCenterX = CONFIG.birdX + CONFIG.birdWidth / 2;
        const birdCenterY = gameState.birdY + CONFIG.birdHeight / 2;
        
        // Save context for bird rotation
        ctx.save();
        ctx.translate(birdCenterX, birdCenterY);
        ctx.rotate(rotationAngle);
        
        // Draw bird body (rotated)
        ctx.fillStyle = CONFIG.birdColor;
        ctx.fillRect(-CONFIG.birdWidth / 2, -CONFIG.birdHeight / 2, CONFIG.birdWidth, CONFIG.birdHeight);
        
        // Draw orange beak (rotated with bird)
        ctx.fillStyle = CONFIG.beakColor;
        const beakWidth = CONFIG.birdWidth * 0.2; 
        const beakHeight = CONFIG.birdHeight * 0.33;
        const beakX = CONFIG.birdWidth / 2; // Position at right edge of bird body
        const beakY = -beakHeight / 2; // Center beak vertically
        ctx.fillRect(beakX, beakY, beakWidth, beakHeight);
        
        // Draw wing (rotated with bird)
        ctx.fillStyle = CONFIG.wingColor;
        const wingWidth = CONFIG.birdWidth * 0.66;
        const wingHeight = CONFIG.birdHeight * 0.33;
        const wingX = CONFIG.birdWidth / 2 - wingWidth * 1.75; // Position wing on right side relative to center
        const wingY = -wingHeight / 2; // Center wing vertically relative to center
        
        // Save context for wing animation
        ctx.save();
        
        // Set rotation origin to the right side of the wing, centered vertically
        const wingRotationX = wingX + wingWidth;
        const wingRotationY = wingY + wingHeight / 2;
        
        ctx.translate(wingRotationX, wingRotationY);
        
        if (gameState.animationFrame === 0) {
            // Frame 1: Wing at rest (0 degrees)
            ctx.rotate(0);
        } else {
            // Frame 2: Wing rotated up (15 degrees)
            ctx.rotate(-0.26); // -15 degrees in radians
        }
        
        // Draw the wing
        ctx.fillRect(-wingWidth, -wingHeight / 2, wingWidth, wingHeight);
        
        // Restore wing context
        ctx.restore();
        
        // Restore bird context
        ctx.restore();
    }

    drawObstacle() {
        const { ctx } = gameState;
        ctx.fillStyle = CONFIG.obstacleColor;
        ctx.fillRect(gameState.obstacleX, 0, CONFIG.obstacleWidth, gameState.obstacleHeight);
        ctx.fillRect(
            gameState.obstacleX, 
            gameState.obstacleHeight + gameState.gap, 
            CONFIG.obstacleWidth, 
            CONFIG.canvasHeight - gameState.obstacleHeight - gameState.gap
        );
    }

    checkCollisions() {
        // Check if bird hit the ground or ceiling
        if (gameState.birdY < 0 || gameState.birdY + CONFIG.birdHeight > CONFIG.canvasHeight) {
            this.endGame();
            return;
        }

        // Check if bird hit an obstacle
        const birdRight = CONFIG.birdX + CONFIG.birdWidth;
        const birdBottom = gameState.birdY + CONFIG.birdHeight;
        const obstacleRight = gameState.obstacleX + CONFIG.obstacleWidth;
        
        if (
            birdRight > gameState.obstacleX && 
            CONFIG.birdX < obstacleRight &&
            (gameState.birdY < gameState.obstacleHeight || 
             birdBottom > gameState.obstacleHeight + gameState.gap)
        ) {
            this.endGame();
        }
    }

    resetObstacle() {
        gameState.obstacleX = CONFIG.canvasWidth;
        gameState.obstacleHeight = Math.random() * (CONFIG.canvasHeight - gameState.gap - 100) + 50;
    }

    endGame() {
        gameState.gameRunning = false;
        
        if (gameState.animationFrameId) {
            cancelAnimationFrame(gameState.animationFrameId);
            gameState.animationFrameId = null;
        }

        DOM.roundScore.textContent = gameState.score;
        DOM.gameOverScreen.style.display = 'block';

        if (gameState.score > 0) {
            this.ogpManager.saveScore(gameState.score)
        }
    }

    flap() {
        if (gameState.gameRunning) {
            gameState.birdVelocity = -CONFIG.flapStrength;
            this.updateAnimationFrame();
        }
    }
}

// Initialize the game when the window loads
window.addEventListener('load', () => {
    const ogpManager = new OGPManager();
    const game = new FlappyBirdGame(ogpManager);
}); 
