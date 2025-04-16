// 2048 Game Logic
class Game2048 {
    constructor() {
        this.grid = Array(4).fill().map(() => Array(4).fill(0));
        this.score = 0;
        this.bestScore = localStorage.getItem('2048-best-score') || 0;
        this.gameOver = false;
        this.won = false;
        this.leaderboard = new Leaderboard();
        this.touchStartX = null;
        this.touchStartY = null;
        this.setupEventListeners();
        this.init();
    }

    init() {
        this.grid = Array(4).fill().map(() => Array(4).fill(0));
        this.score = 0;
        this.gameOver = false;
        this.won = false;
        this.hideMessage();
        this.updateBestScore();
        this.addRandomTile();
        this.addRandomTile();
        this.updateGrid();
        this.leaderboard.updateLeaderboard();
    }

    setupEventListeners() {
        document.getElementById('new-game-button').addEventListener('click', () => this.init());
        document.getElementById('retry-button').addEventListener('click', () => this.init());
        
        document.addEventListener('keydown', (e) => {
            if (this.gameOver) return;
            
            switch(e.key) {
                case 'ArrowUp':
                    this.move('up');
                    break;
                case 'ArrowDown':
                    this.move('down');
                    break;
                case 'ArrowLeft':
                    this.move('left');
                    break;
                case 'ArrowRight':
                    this.move('right');
                    break;
            }
        });

        const gridContainer = document.querySelector('.grid-container');
        
        gridContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.gameOver) return;
            
            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            
            gridContainer.classList.add('touch-active');
        }, { passive: false });

        gridContainer.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });

        gridContainer.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.gameOver || !this.touchStartX || !this.touchStartY) return;
            
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - this.touchStartX;
            const deltaY = touch.clientY - this.touchStartY;
            
            gridContainer.classList.remove('touch-active');

            const minSwipeDistance = 30;
            
            if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
                return;
            }

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > 0) {
                    this.move('right');
                } else {
                    this.move('left');
                }
            } else {
                if (deltaY > 0) {
                    this.move('down');
                } else {
                    this.move('up');
                }
            }

            this.touchStartX = null;
            this.touchStartY = null;
        }, { passive: false });

        const touchButtons = {
            'touch-up': 'up',
            'touch-down': 'down',
            'touch-left': 'left',
            'touch-right': 'right'
        };

        Object.entries(touchButtons).forEach(([buttonId, direction]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                ['touchstart', 'mousedown'].forEach(eventType => {
                    button.addEventListener(eventType, (e) => {
                        e.preventDefault();
                        if (!this.gameOver) {
                            this.move(direction);
                        }
                    });
                });
            }
        });
    }

    move(direction) {
        let moved = false;
        const oldGrid = JSON.stringify(this.grid);

        switch(direction) {
            case 'up':
                moved = this.moveUp();
                break;
            case 'down':
                moved = this.moveDown();
                break;
            case 'left':
                moved = this.moveLeft();
                break;
            case 'right':
                moved = this.moveRight();
                break;
        }

        if (moved) {
            this.addRandomTile();
            this.updateGrid();
            this.checkGameOver();
        }
    }

    moveUp() {
        let moved = false;
        for (let col = 0; col < 4; col++) {
            for (let row = 1; row < 4; row++) {
                if (this.grid[row][col] !== 0) {
                    let currentRow = row;
                    while (currentRow > 0 && this.grid[currentRow - 1][col] === 0) {
                        this.grid[currentRow - 1][col] = this.grid[currentRow][col];
                        this.grid[currentRow][col] = 0;
                        currentRow--;
                        moved = true;
                    }
                    if (currentRow > 0 && this.grid[currentRow - 1][col] === this.grid[currentRow][col]) {
                        this.grid[currentRow - 1][col] *= 2;
                        this.score += this.grid[currentRow - 1][col];
                        this.grid[currentRow][col] = 0;
                        moved = true;
                        if (this.grid[currentRow - 1][col] === 2048) {
                            this.won = true;
                        }
                    }
                }
            }
        }
        return moved;
    }

    moveDown() {
        let moved = false;
        for (let col = 0; col < 4; col++) {
            for (let row = 2; row >= 0; row--) {
                if (this.grid[row][col] !== 0) {
                    let currentRow = row;
                    while (currentRow < 3 && this.grid[currentRow + 1][col] === 0) {
                        this.grid[currentRow + 1][col] = this.grid[currentRow][col];
                        this.grid[currentRow][col] = 0;
                        currentRow++;
                        moved = true;
                    }
                    if (currentRow < 3 && this.grid[currentRow + 1][col] === this.grid[currentRow][col]) {
                        this.grid[currentRow + 1][col] *= 2;
                        this.score += this.grid[currentRow + 1][col];
                        this.grid[currentRow][col] = 0;
                        moved = true;
                        if (this.grid[currentRow + 1][col] === 2048) {
                            this.won = true;
                        }
                    }
                }
            }
        }
        return moved;
    }

    moveLeft() {
        let moved = false;
        for (let row = 0; row < 4; row++) {
            for (let col = 1; col < 4; col++) {
                if (this.grid[row][col] !== 0) {
                    let currentCol = col;
                    while (currentCol > 0 && this.grid[row][currentCol - 1] === 0) {
                        this.grid[row][currentCol - 1] = this.grid[row][currentCol];
                        this.grid[row][currentCol] = 0;
                        currentCol--;
                        moved = true;
                    }
                    if (currentCol > 0 && this.grid[row][currentCol - 1] === this.grid[row][currentCol]) {
                        this.grid[row][currentCol - 1] *= 2;
                        this.score += this.grid[row][currentCol - 1];
                        this.grid[row][currentCol] = 0;
                        moved = true;
                        if (this.grid[row][currentCol - 1] === 2048) {
                            this.won = true;
                        }
                    }
                }
            }
        }
        return moved;
    }

    moveRight() {
        let moved = false;
        for (let row = 0; row < 4; row++) {
            for (let col = 2; col >= 0; col--) {
                if (this.grid[row][col] !== 0) {
                    let currentCol = col;
                    while (currentCol < 3 && this.grid[row][currentCol + 1] === 0) {
                        this.grid[row][currentCol + 1] = this.grid[row][currentCol];
                        this.grid[row][currentCol] = 0;
                        currentCol++;
                        moved = true;
                    }
                    if (currentCol < 3 && this.grid[row][currentCol + 1] === this.grid[row][currentCol]) {
                        this.grid[row][currentCol + 1] *= 2;
                        this.score += this.grid[row][currentCol + 1];
                        this.grid[row][currentCol] = 0;
                        moved = true;
                        if (this.grid[row][currentCol + 1] === 2048) {
                            this.won = true;
                        }
                    }
                }
            }
        }
        return moved;
    }

    addRandomTile() {
        const emptyCells = [];
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (this.grid[row][col] === 0) {
                    emptyCells.push({row, col});
                }
            }
        }
        if (emptyCells.length > 0) {
            const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            this.grid[randomCell.row][randomCell.col] = Math.random() < 0.9 ? 2 : 4;
        }
    }

    updateGrid() {
        const gridContainer = document.querySelector('.grid-container');
        const cells = gridContainer.querySelectorAll('.grid-cell');
        let index = 0;
        
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const cell = cells[index];
                const value = this.grid[row][col];
                
                cell.textContent = value || '';
                cell.setAttribute('data-value', value);
                
                index++;
            }
        }
        
        document.getElementById('score').textContent = this.score;
        this.updateBestScore();
    }

    updateBestScore() {
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('2048-best-score', this.bestScore);
        }
        document.getElementById('best-score').textContent = this.bestScore;
    }

    checkGameOver() {
        if (this.won) {
            this.showMessage('You win!');
            this.submitScore();
            return;
        }

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                if (this.grid[row][col] === 0) {
                    return;
                }
            }
        }

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const current = this.grid[row][col];
                if (
                    (row < 3 && current === this.grid[row + 1][col]) ||
                    (col < 3 && current === this.grid[row][col + 1])
                ) {
                    return;
                }
            }
        }

        this.gameOver = true;
        this.showMessage('Game over!');
        this.submitScore();
    }

    submitScore() {
        if (this.score > 0) {
            this.leaderboard.showNameEntry(this.score);
        }
    }

    showMessage(message) {
        const gameMessage = document.getElementById('game-message');
        gameMessage.querySelector('p').textContent = message;
        gameMessage.style.display = 'flex';
    }

    hideMessage() {
        const gameMessage = document.getElementById('game-message');
        gameMessage.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    let game;
    
    document.querySelector('[data-app="game2048"]').addEventListener('click', () => {
        if (!game) {
            game = new Game2048();
        } else {
            game.init();
        }
    });
}); 