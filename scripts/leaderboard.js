// Simple profanity filter - this is a basic list, you might want to use a more comprehensive one
const PROFANITY_LIST = [
    'fuck', 'shit', 'ass', 'bitch', 'dick', 'pussy', 'cock', 'cunt', 'whore',
    // Add more words as needed
];

class Leaderboard {
    constructor() {
        this.db = firebase.firestore();
        this.scoresRef = this.db.collection('2048-scores');
        this.maxScores = 10; // Number of scores to display
        this.isInitialized = false;
        this.initializeFirebase();
    }

    async initializeFirebase() {
        try {
            // Test if we have read access
            await this.scoresRef.limit(1).get();
            this.isInitialized = true;
            console.log('Leaderboard initialized successfully');
            await this.cleanupDuplicates(); // Clean up duplicates on initialization
        } catch (error) {
            console.error('Leaderboard initialization error:', error);
            this.handleError('Leaderboard is temporarily unavailable. Scores will only be saved locally.');
        }
    }

    async cleanupDuplicates() {
        try {
            // Get all scores
            const snapshot = await this.scoresRef.get();
            const scoresByName = new Map();

            // Group scores by name and keep only the highest score
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const name = data.name;
                const score = data.score;
                
                if (!scoresByName.has(name) || scoresByName.get(name).score < score) {
                    scoresByName.set(name, {
                        docId: doc.id,
                        score: score,
                        timestamp: data.timestamp
                    });
                }
            });

            // Delete all documents except the highest score for each name
            const batch = this.db.batch();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const highestScore = scoresByName.get(data.name);
                
                if (doc.id !== highestScore.docId) {
                    batch.delete(doc.ref);
                }
            });

            await batch.commit();
            console.log('Duplicate cleanup completed');
            await this.updateLeaderboard();
        } catch (error) {
            console.error('Error cleaning up duplicates:', error);
        }
    }

    async addScore(name, score) {
        if (this.containsProfanity(name)) {
            throw new Error('Please use appropriate language for your name.');
        }

        const cleanName = name.trim();
        try {
            // Check if the name already exists
            const querySnapshot = await this.scoresRef
                .where('name', '==', cleanName)
                .get();

            if (!querySnapshot.empty) {
                // Name exists, check if new score is higher
                const existingDoc = querySnapshot.docs[0];
                const existingScore = existingDoc.data().score;

                if (score > existingScore) {
                    // Update existing document with new higher score
                    await existingDoc.ref.update({
                        score: score,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                // If new score is not higher, ignore it
            } else {
                // Name doesn't exist, add new score
                await this.scoresRef.add({
                    name: cleanName,
                    score: score,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            await this.updateLeaderboard();
        } catch (error) {
            console.error('Error adding score:', error);
            throw error;
        }
    }

    saveLocalScore(name, score) {
        try {
            const localScores = JSON.parse(localStorage.getItem('2048-local-scores') || '[]');
            localScores.push({ name, score, timestamp: new Date().toISOString() });
            localScores.sort((a, b) => b.score - a.score);
            localStorage.setItem('2048-local-scores', JSON.stringify(localScores.slice(0, this.maxScores)));
            this.updateLocalLeaderboard();
        } catch (error) {
            console.error('Error saving local score:', error);
        }
    }

    containsProfanity(text) {
        const lowercaseText = text.toLowerCase();
        return PROFANITY_LIST.some(word => lowercaseText.includes(word));
    }

    async updateLeaderboard() {
        try {
            const snapshot = await this.scoresRef
                .orderBy('score', 'desc')
                .limit(this.maxScores)
                .get();

            const leaderboardList = document.getElementById('leaderboard-list');
            leaderboardList.innerHTML = '';

            snapshot.docs.forEach((doc, index) => {
                const data = doc.data();
                const li = document.createElement('li');
                li.className = 'leaderboard-item';
                li.innerHTML = `
                    <span class="leaderboard-rank">#${index + 1}</span>
                    <span class="leaderboard-name">${this.escapeHtml(data.name)}</span>
                    <span class="leaderboard-score">${data.score}</span>
                `;
                leaderboardList.appendChild(li);
            });
        } catch (error) {
            console.error('Error updating leaderboard:', error);
            this.updateLocalLeaderboard();
        }
    }

    updateLocalLeaderboard() {
        try {
            const localScores = JSON.parse(localStorage.getItem('2048-local-scores') || '[]');
            const leaderboardList = document.getElementById('leaderboard-list');
            leaderboardList.innerHTML = '';

            localScores.forEach((score, index) => {
                this.addLeaderboardItem(index + 1, score.name, score.score);
            });
        } catch (error) {
            console.error('Error updating local leaderboard:', error);
        }
    }

    addLeaderboardItem(rank, name, score) {
        const leaderboardList = document.getElementById('leaderboard-list');
        const li = document.createElement('li');
        li.className = 'leaderboard-item';
        li.innerHTML = `
            <span class="leaderboard-rank">#${rank}</span>
            <span class="leaderboard-name">${this.escapeHtml(name)}</span>
            <span class="leaderboard-score">${score}</span>
        `;
        leaderboardList.appendChild(li);
    }

    handleError(message) {
        const leaderboardTitle = document.querySelector('.leaderboard-title');
        const errorSpan = document.createElement('span');
        errorSpan.style.fontSize = '12px';
        errorSpan.style.color = '#e74c3c';
        errorSpan.style.display = 'block';
        errorSpan.textContent = message;
        leaderboardTitle.appendChild(errorSpan);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNameEntry(score) {
        const overlay = document.getElementById('overlay');
        const dialog = document.getElementById('name-entry-dialog');
        const input = document.getElementById('name-entry-input');
        const submit = document.getElementById('name-entry-submit');

        overlay.style.display = 'block';
        dialog.style.display = 'block';
        input.value = '';
        input.focus();

        const handleSubmit = async () => {
            const name = input.value.trim();
            if (name) {
                try {
                    await this.addScore(name, score);
                    overlay.style.display = 'none';
                    dialog.style.display = 'none';
                } catch (error) {
                    alert(error.message);
                }
            }
        };

        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                handleSubmit();
            }
        };

        submit.onclick = handleSubmit;
        input.onkeypress = handleKeyPress;
    }
} 