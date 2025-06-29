// Authentication Utilities
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('token');
        this.refreshInProgress = false;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token;
    }

    // Get current token
    getToken() {
        return this.token;
    }

    // Set token
    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    // Remove token (logout)
    removeToken() {
        this.token = null;
        localStorage.removeItem('token');
    }

    // Verify token validity
    async verifyToken() {
        if (!this.token) {
            return false;
        }

        try {
            const response = await fetch(API_CONFIG.baseUrl + API_CONFIG.endpoints.users.me, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                return true;
            } else if (response.status === 401) {
                // Token is invalid, try to refresh
                return await this.refreshToken();
            }
            return false;
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    }

    // Refresh token
    async refreshToken() {
        if (this.refreshInProgress) {
            // Wait for ongoing refresh
            return new Promise((resolve) => {
                const checkRefresh = setInterval(() => {
                    if (!this.refreshInProgress) {
                        clearInterval(checkRefresh);
                        resolve(!!this.token);
                    }
                }, 100);
            });
        }

        this.refreshInProgress = true;

        try {
            const response = await fetch(API_CONFIG.baseUrl + API_CONFIG.endpoints.auth.refresh, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.setToken(data.access_token);
                this.refreshInProgress = false;
                return true;
            } else {
                // Refresh failed, user needs to login again
                this.removeToken();
                this.refreshInProgress = false;
                return false;
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.removeToken();
            this.refreshInProgress = false;
            return false;
        }
    }

    // Get authenticated headers for API requests
    async getAuthHeaders() {
        if (!this.token) {
            throw new Error('No authentication token');
        }

        // Verify token before making request
        const isValid = await this.verifyToken();
        if (!isValid) {
            throw new Error('Authentication failed');
        }

        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    // Handle authentication errors
    handleAuthError() {
        this.removeToken();
        window.location.href = 'auth.html';
    }

    // Auto-refresh token periodically (every 6 days)
    startAutoRefresh() {
        // Refresh token every 6 days (6 * 24 * 60 * 60 * 1000 = 518400000 ms)
        setInterval(async () => {
            if (this.token) {
                await this.refreshToken();
            }
        }, 518400000);
    }

    // Check authentication on page load
    async checkAuthOnLoad() {
        if (this.token) {
            const isValid = await this.verifyToken();
            if (!isValid) {
                this.handleAuthError();
            }
        }
    }
}

// Create global auth manager instance
const authManager = new AuthManager();

// Stats tracking functions
const statsManager = {
    initializeStats() {
        // Initialize stats for both pyq and pyqreel if they don't exist
        if (!localStorage.getItem('pyqStats')) {
            localStorage.setItem('pyqStats', JSON.stringify({
                questionsScrolled: 0,
                correctAnswers: 0,
                totalAnswers: 0,
                lastActiveDate: new Date().toDateString(),
                streak: 0,
                lastStreakDate: null
            }));
        }
        if (!localStorage.getItem('pyqreelStats')) {
            localStorage.setItem('pyqreelStats', JSON.stringify({
                questionsScrolled: 0,
                correctAnswers: 0,
                totalAnswers: 0,
                lastActiveDate: new Date().toDateString(),
                streak: 0,
                lastStreakDate: null
            }));
        }
        // Initialize daily goal if not set
        if (!localStorage.getItem('dailyQuestionGoal')) {
            this.showDailyGoalPopup();
        }
        // Try to sync with backend
        this.syncWithBackend();
    },

    showDailyGoalPopup() {
        // Create and show the popup
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay active';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;

        const card = document.createElement('div');
        card.className = 'card';
        card.style.cssText = `
            position: relative;
            width: 350px;
            background-color: white;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            overflow: hidden;
            z-index: 10;
        `;

        card.innerHTML = `
            <div style="background-color: #5e17eb; color: white; padding: 20px; text-align: center;">
                <h2 style="font-size: 24px; margin-bottom: 10px;">Set Your Daily Goal</h2>
                <p style="font-size: 14px; opacity: 0.9;">How many questions would you like to practice daily?</p>
            </div>
            <div style="padding: 25px;">
                <div style="margin-bottom: 25px;">
                    <p style="font-size: 14px; color: #333; margin-bottom: 15px;">Choose your daily target:</p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button class="goal-btn" data-value="10" style="flex: 1; padding: 10px; border: 2px solid #5e17eb; background: white; color: #5e17eb; border-radius: 8px; cursor: pointer; font-weight: bold;">10</button>
                        <button class="goal-btn" data-value="25" style="flex: 1; padding: 10px; border: 2px solid #5e17eb; background: white; color: #5e17eb; border-radius: 8px; cursor: pointer; font-weight: bold;">25</button>
                        <button class="goal-btn" data-value="50" style="flex: 1; padding: 10px; border: 2px solid #5e17eb; background: white; color: #5e17eb; border-radius: 8px; cursor: pointer; font-weight: bold;">50</button>
                    </div>
                    <div style="margin-top: 20px;">
                        <input type="number" id="customGoal" placeholder="Or enter custom number" style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px;">
                    </div>
                </div>
                <button id="setGoalBtn" style="width: 100%; padding: 15px; background-color: #5e17eb; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer;">Set Goal</button>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Add event listeners
        const goalBtns = card.querySelectorAll('.goal-btn');
        const customGoalInput = card.querySelector('#customGoal');
        const setGoalBtn = card.querySelector('#setGoalBtn');
        let selectedGoal = null;

        goalBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                goalBtns.forEach(b => b.style.background = 'white');
                btn.style.background = '#5e17eb';
                btn.style.color = 'white';
                selectedGoal = parseInt(btn.dataset.value);
                customGoalInput.value = '';
            });
        });

        customGoalInput.addEventListener('input', () => {
            goalBtns.forEach(btn => {
                btn.style.background = 'white';
                btn.style.color = '#5e17eb';
            });
            selectedGoal = parseInt(customGoalInput.value) || null;
        });

        setGoalBtn.addEventListener('click', () => {
            if (selectedGoal && selectedGoal > 0) {
                localStorage.setItem('dailyQuestionGoal', selectedGoal);
                overlay.remove();
                window.location.reload();
            } else {
                alert('Please select or enter a valid goal');
            }
        });
    },

    getDailyGoal() {
        return parseInt(localStorage.getItem('dailyQuestionGoal')) || 0;
    },

    async syncWithBackend() {
        try {
            const headers = await authManager.getAuthHeaders();
            const response = await fetch(`${API_CONFIG.baseUrl}/users/stats`, {
                headers: headers
            });
            
            if (response.ok) {
                const backendStats = await response.json();
                const pyqStats = JSON.parse(localStorage.getItem('pyqStats'));
                const pyqreelStats = JSON.parse(localStorage.getItem('pyqreelStats'));
                
                // Update streaks from backend
                pyqStats.streak = backendStats.pyqStreak || pyqStats.streak;
                pyqreelStats.streak = backendStats.pyqreelStreak || pyqreelStats.streak;
                
                localStorage.setItem('pyqStats', JSON.stringify(pyqStats));
                localStorage.setItem('pyqreelStats', JSON.stringify(pyqreelStats));
            }
        } catch (error) {
            console.error('Error syncing with backend:', error);
        }
    },

    incrementQuestionsScrolled(page = 'pyqreel') {
        const statsKey = page === 'pyq' ? 'pyqStats' : 'pyqreelStats';
        const stats = JSON.parse(localStorage.getItem(statsKey));
        stats.questionsScrolled++;
        localStorage.setItem(statsKey, JSON.stringify(stats));

        // Check if daily goal is met
        const dailyGoal = this.getDailyGoal();
        const totalQuestionsToday = this.getTotalQuestionsToday();
        
        if (totalQuestionsToday >= dailyGoal) {
            this.updateStreak();
        }
        
        this.syncWithBackend();
    },

    recordAnswer(isCorrect, page = 'pyqreel') {
        const statsKey = page === 'pyq' ? 'pyqStats' : 'pyqreelStats';
        const stats = JSON.parse(localStorage.getItem(statsKey));
        stats.totalAnswers++;
        if (isCorrect) {
            stats.correctAnswers++;
        }
        localStorage.setItem(statsKey, JSON.stringify(stats));
        this.syncWithBackend();
    },

    updateStreak() {
        const today = new Date().toDateString();
        const dailyGoal = this.getDailyGoal();
        const totalQuestionsToday = this.getTotalQuestionsToday();
        
        // Only update streak if daily goal is met
        if (totalQuestionsToday >= dailyGoal) {
            const pyqStats = JSON.parse(localStorage.getItem('pyqStats'));
            const pyqreelStats = JSON.parse(localStorage.getItem('pyqreelStats'));
            
            // Check if streak was already updated today
            if (pyqStats.lastStreakDate !== today && pyqreelStats.lastStreakDate !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayString = yesterday.toDateString();
                
                // Check if streak was maintained (updated yesterday)
                if (pyqStats.lastStreakDate === yesterdayString || pyqreelStats.lastStreakDate === yesterdayString) {
                    pyqStats.streak++;
                    pyqreelStats.streak++;
                } else {
                    // Streak broken, start new streak
                    pyqStats.streak = 1;
                    pyqreelStats.streak = 1;
                }
                
                // Update last streak date
                pyqStats.lastStreakDate = today;
                pyqreelStats.lastStreakDate = today;
                
                localStorage.setItem('pyqStats', JSON.stringify(pyqStats));
                localStorage.setItem('pyqreelStats', JSON.stringify(pyqreelStats));
                this.syncWithBackend();
            }
        }
    },

    getTotalQuestionsToday() {
        const pyqStats = JSON.parse(localStorage.getItem('pyqStats'));
        const pyqreelStats = JSON.parse(localStorage.getItem('pyqreelStats'));
        const today = new Date().toDateString();
        
        // Reset questions if it's a new day
        if (pyqStats.lastActiveDate !== today) {
            pyqStats.questionsScrolled = 0;
            pyqStats.lastActiveDate = today;
            localStorage.setItem('pyqStats', JSON.stringify(pyqStats));
        }
        if (pyqreelStats.lastActiveDate !== today) {
            pyqreelStats.questionsScrolled = 0;
            pyqreelStats.lastActiveDate = today;
            localStorage.setItem('pyqreelStats', JSON.stringify(pyqreelStats));
        }
        
        return pyqStats.questionsScrolled + pyqreelStats.questionsScrolled;
    },

    getStats() {
        // Initialize if not exists
        if (!localStorage.getItem('pyqStats') || !localStorage.getItem('pyqreelStats')) {
            this.initializeStats();
            return this.getStats();
        }

        // Get stats from both sources
        const pyqStats = JSON.parse(localStorage.getItem('pyqStats'));
        const pyqreelStats = JSON.parse(localStorage.getItem('pyqreelStats'));

        // Get daily goal progress
        const dailyGoal = this.getDailyGoal();
        const totalQuestionsToday = this.getTotalQuestionsToday();
        const goalProgress = Math.min((totalQuestionsToday / dailyGoal) * 100, 100);

        // Combine stats
        const totalQuestionsScrolled = totalQuestionsToday;
        const totalCorrectAnswers = (pyqStats.correctAnswers || 0) + (pyqreelStats.correctAnswers || 0);
        const totalAnswers = (pyqStats.totalAnswers || 0) + (pyqreelStats.totalAnswers || 0);
        const maxStreak = Math.max(pyqStats.streak || 0, pyqreelStats.streak || 0);

        return {
            questionsScrolled: totalQuestionsScrolled,
            correctAnswers: totalCorrectAnswers,
            totalAnswers: totalAnswers,
            streak: maxStreak,
            accuracy: totalAnswers > 0 
                ? Math.round((totalCorrectAnswers / totalAnswers) * 100) 
                : 0,
            dailyGoal: dailyGoal,
            goalProgress: Math.round(goalProgress)
        };
    }
};

// Initialize stats when the module loads
statsManager.initializeStats();

// Export the statsManager
window.statsManager = statsManager;

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
} 