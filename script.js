document.addEventListener('DOMContentLoaded', () => {
    // Rate Limiting System
    const RateLimiter = {
        // Configuration for different action types
        limits: {
            messages: { max: 50, window: 3600000 }, // 50 messages per hour
            attachments: { max: 10, window: 86400000 }, // 10 attachments per day
            emails: { max: 2, window: 86400000 }, // 2 emails per day
            searches: { max: 20, window: 86400000 }, // 20 searches per day
            totalMessages: { max: 200, window: 86400000 }, // 200 total messages per day
            totalStorage: { max: 20 * 1024 * 1024, window: 86400000 } // 20MB storage per day
        },
        
        // Get device ID (stored in localStorage)
        getDeviceId() {
            let deviceId = localStorage.getItem('device_id');
            if (!deviceId) {
                deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
                localStorage.setItem('device_id', deviceId);
            }
            return deviceId;
        },
        
        // Get current usage data
        getUsageData() {
            const data = localStorage.getItem('rate_limit_data');
            return data ? JSON.parse(data) : {};
        },
        
        // Save usage data
        saveUsageData(data) {
            localStorage.setItem('rate_limit_data', JSON.stringify(data));
        },
        
        // Clean old entries
        cleanOldEntries(actionType, windowMs) {
            const data = this.getUsageData();
            const deviceId = this.getDeviceId();
            const now = Date.now();
            
            if (data[deviceId] && data[deviceId][actionType]) {
                data[deviceId][actionType] = data[deviceId][actionType].filter(entry => {
                    // Handle both timestamp numbers and objects with timestamp property
                    const timestamp = typeof entry === 'number' ? entry : entry.timestamp;
                    return now - timestamp < windowMs;
                });
                
                if (data[deviceId][actionType].length === 0) {
                    delete data[deviceId][actionType];
                }
            }
            
            this.saveUsageData(data);
        },
        
        // Check if action is allowed
        canPerformAction(actionType, size = 0) {
            const limit = this.limits[actionType];
            if (!limit) return true;
            
            this.cleanOldEntries(actionType, limit.window);
            
            const data = this.getUsageData();
            const deviceId = this.getDeviceId();
            const deviceData = data[deviceId] || {};
            const actionData = deviceData[actionType] || [];
            
            // For storage limits, calculate total size
            if (actionType === 'totalStorage') {
                const totalSize = actionData.reduce((sum, entry) => sum + (entry.size || 0), 0);
                return totalSize + size <= limit.max;
            }
            
            // For count-based limits
            return actionData.length < limit.max;
        },
        
        // Record an action
        recordAction(actionType, metadata = {}) {
            const data = this.getUsageData();
            const deviceId = this.getDeviceId();
            
            if (!data[deviceId]) {
                data[deviceId] = {};
            }
            
            if (!data[deviceId][actionType]) {
                data[deviceId][actionType] = [];
            }
            
            // For storage, record size
            if (actionType === 'totalStorage') {
                data[deviceId][actionType].push({
                    timestamp: Date.now(),
                    size: metadata.size || 0
                });
            } else {
                data[deviceId][actionType].push(Date.now());
            }
            
            this.saveUsageData(data);
        },
        
        // Get remaining allowance
        getRemainingAllowance(actionType) {
            const limit = this.limits[actionType];
            if (!limit) return Infinity;
            
            this.cleanOldEntries(actionType, limit.window);
            
            const data = this.getUsageData();
            const deviceId = this.getDeviceId();
            const deviceData = data[deviceId] || {};
            const actionData = deviceData[actionType] || [];
            
            if (actionType === 'totalStorage') {
                const totalSize = actionData.reduce((sum, entry) => sum + (entry.size || 0), 0);
                return Math.max(0, limit.max - totalSize);
            }
            
            return Math.max(0, limit.max - actionData.length);
        },
        
        // Get current usage for an action type
        getCurrentUsage(actionType) {
            const limit = this.limits[actionType];
            if (!limit) return 0;
            
            this.cleanOldEntries(actionType, limit.window);
            
            const data = this.getUsageData();
            const deviceId = this.getDeviceId();
            const deviceData = data[deviceId] || {};
            const actionData = deviceData[actionType] || [];
            
            if (actionType === 'totalStorage') {
                return actionData.reduce((sum, entry) => sum + (entry.size || 0), 0);
            }
            
            return actionData.length;
        },
        
        // Get time until reset
        getTimeUntilReset(actionType) {
            const limit = this.limits[actionType];
            if (!limit) return 0;
            
            const data = this.getUsageData();
            const deviceId = this.getDeviceId();
            const deviceData = data[deviceId] || {};
            const actionData = deviceData[actionType] || [];
            
            if (actionData.length === 0) return 0;
            
            // Find the oldest entry
            const oldestTimestamp = Math.min(...actionData.map(entry => 
                typeof entry === 'number' ? entry : entry.timestamp
            ));
            
            const resetTime = oldestTimestamp + limit.window;
            const timeLeft = Math.max(0, resetTime - Date.now());
            
            return timeLeft;
        },
        
        // Format time for display
        formatTimeRemaining(ms) {
            const hours = Math.floor(ms / 3600000);
            const minutes = Math.floor((ms % 3600000) / 60000);
            
            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            }
            return `${minutes}m`;
        },
        
        // Show rate limit error
        showRateLimitError(actionType, customMessage = null) {
            const limit = this.limits[actionType];
            const timeLeft = this.getTimeUntilReset(actionType);
            const formattedTime = this.formatTimeRemaining(timeLeft);
            
            let message = customMessage || `You've reached the limit for ${actionType.replace(/([A-Z])/g, ' $1').toLowerCase()}.`;
            
            // Add detailed info for storage
            if (actionType === 'totalStorage') {
                const currentUsage = this.getCurrentUsage('totalStorage');
                const currentMB = (currentUsage / (1024 * 1024)).toFixed(1);
                const limitMB = (limit.max / (1024 * 1024)).toFixed(0);
                message = `You've used ${currentMB}MB of your ${limitMB}MB daily storage limit.`;
            }
            
            if (timeLeft > 0) {
                message += ` Try again in ${formattedTime}.`;
            }
            
            alert(message);
        }
    };
    
    // Make RateLimiter globally available
    window.RateLimiter = RateLimiter;
    
    // Update time in status bar
    updateTime();
    setInterval(updateTime, 60000);
    
    // Periodically change iPhone background
    changeIphoneBackground();
    setInterval(changeIphoneBackground, 30000); // Change every 30 seconds
    
    // Add message status styles
    const statusStyles = document.createElement('style');
    statusStyles.textContent = `
        .message-status {
            font-size: 10px;
            color: #8e8e93;
            text-align: right;
            margin-top: 2px;
            font-weight: 400;
            padding-right: 4px;
            margin-bottom: 6px;
        }
        
        .message-container {
            display: flex;
            flex-direction: column;
            align-self: flex-end;
            max-width: 85%;
            margin-bottom: -6px;
        }
        
        .message {
            padding: 8px 12px;
            border-radius: 18px;
            line-height: 1.4;
            max-width: 100%;
            word-wrap: break-word;
            overflow-wrap: break-word;
            white-space: pre-wrap;
            position: relative;
            transition: transform 0.3s ease;
            cursor: pointer;
        }
        
        .message-sent {
            background-color: #007AFF;
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
            text-align: left;
        }
        
        .message-received {
            background-color: #E9E9EB;
            color: #000;
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            margin-right: 10px;
        }
        
        .message-time-hidden {
            position: absolute;
            font-size: 10px;
            color: #8e8e93;
            opacity: 0;
            transition: opacity 0.3s ease;
            right: 0px;
            bottom: -16px;
            white-space: nowrap;
        }
        
        .message-received .message-time-hidden {
            right: auto;
            left: 0px;
        }
        
        .message:hover {
            transform: translateY(-10px);
        }
        
        .message:hover .message-time-hidden {
            opacity: 1;
        }
        
        .welcome-message {
            background-color: #E9E9EB;
            color: #000;
            border-bottom-left-radius: 4px;
            margin-right: 35px;
            margin-bottom: 15px;
            padding: 10px 14px;
        }
        
        .messages-content {
            padding: 10px 10px;
            display: flex;
            flex-direction: column;
            /* iOS-style scrollbar */
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
            overflow-y: auto;
        }
        
        .messages-content::-webkit-scrollbar {
            width: 6px;
            background: transparent;
        }
        
        .messages-content::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .messages-content::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, 0.1);
            border-radius: 3px;
            min-height: 40px;
        }
        
        .messages-content:hover::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, 0.2);
        }
    `;
    document.head.appendChild(statusStyles);
    
    // App opening functionality
    const apps = document.querySelectorAll('.app');
    const appScreens = document.querySelectorAll('.app-screen');
    const homeScreen = document.getElementById('home-screen');
    const homeButton = document.querySelector('.home-button');
    const backButtons = document.querySelectorAll('.back-button');
    
    // Add click outside handler for projects folder
    document.addEventListener('click', (event) => {
        const projectsApp = document.getElementById('projects-app');
        const projectsFolder = document.querySelector('.projects-folder');
        
        if (projectsApp && projectsApp.classList.contains('active')) {
            // Check if click is outside the projects folder
            if (!projectsFolder.contains(event.target) && !event.target.closest('.app[data-app="projects"]')) {
                // Close the projects folder
                projectsApp.classList.remove('active');
                // Reset status bar
                const statusBar = document.querySelector('.status-bar');
                statusBar.classList.remove('in-app');
                statusBar.classList.remove('light-mode');
            }
        }
    });
    
    // Open an app when clicked
    apps.forEach(app => {
        app.addEventListener('click', () => {
            const appName = app.getAttribute('data-app');
            
            // Special handling for resume app - open popup instead
            if (appName === 'resume') {
                openResumePopup();
                return;
            }
            
            const appScreen = document.getElementById(`${appName}-app`);
            
            if (appScreen) {
                // Add active class to show app screen
                appScreen.classList.add('active');
                // Update status bar to black for apps
                const statusBar = document.querySelector('.status-bar');
                statusBar.classList.add('in-app');
                
                // For Safari, Mail and other light background apps, use light-mode status bar
                if (appName === 'safari' || appName === 'mail') {
                    statusBar.classList.add('light-mode');
                } else {
                    statusBar.classList.remove('light-mode');
                }
                
                // Update content display if needed
                updateContentDisplay(appName);
            }
        });
    });
    
    // Go back to home screen when home button is clicked
    homeButton.addEventListener('click', () => {
        appScreens.forEach(screen => {
            screen.classList.remove('active');
        });
        // Reset status bar to transparent for home screen
        const statusBar = document.querySelector('.status-bar');
        statusBar.classList.remove('in-app');
        statusBar.classList.remove('light-mode');
    });
    
    // Go back to home screen when back button is clicked
    backButtons.forEach(button => {
        button.addEventListener('click', function() {
            // For Safari, go back to favorites view if in browser view
            const safariApp = this.closest('#safari-app');
            if (safariApp) {
                const browserView = safariApp.querySelector('.safari-browser-view');
                const favoritesView = safariApp.querySelector('.safari-favorites-view');
                
                if (browserView && browserView.style.display !== 'none') {
                    browserView.style.display = 'none';
                    favoritesView.style.display = 'block';
                    return;
                }
            }
            
            // Default behavior - go back to home screen
            appScreens.forEach(screen => screen.classList.remove('active'));
            homeScreen.style.display = 'flex';
            
            // Reset status bar to transparent for home screen
            const statusBar = document.querySelector('.status-bar');
            statusBar.classList.remove('in-app');
            statusBar.classList.remove('light-mode');
        });
    });
    
    // Initialize skill bars animation
    const skillLevels = document.querySelectorAll('.skill-level');
    
    // Contact form submission
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Message sent! (This is a demo)');
            contactForm.reset();
        });
    }
    
    // Initialize trigger for Let's Talk button
    const talkButton = document.querySelector('.cta-button.secondary');
    if (talkButton) {
        talkButton.addEventListener('click', (e) => {
            e.preventDefault();
            const contactApp = document.getElementById('contact-app');
            if (contactApp) {
                contactApp.classList.add('active');
                updateContentDisplay('contact');
            }
        });
    }

    // Browser functionality
    const urlInput = document.getElementById('url-input');
    const browserFrame = document.getElementById('browser-frame');
    const backBtn = document.getElementById('browser-back');
    const forwardBtn = document.getElementById('browser-forward');
    const refreshBtn = document.getElementById('browser-refresh');
    
    if (urlInput && browserFrame) {
        // Navigate to URL when Enter is pressed in the address bar
        urlInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                navigateToUrl();
            }
        });
        
        // Browser navigation buttons
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                browserFrame.contentWindow.history.back();
            });
        }
        
        if (forwardBtn) {
            forwardBtn.addEventListener('click', function() {
                browserFrame.contentWindow.history.forward();
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                browserFrame.contentWindow.location.reload();
            });
        }
        
        // Function to navigate to URL
        function navigateToUrl() {
            let url = urlInput.value.trim();
            
            // Add https:// if no protocol is specified
            if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            
            // Update iframe source
            if (url) {
                browserFrame.src = url;
                urlInput.value = url;
            }
        }
    }

    // Safari functionality
    const safariApp = document.getElementById('safari-app');
    if (safariApp) {
        const safariSearchInput = document.getElementById('safari-search-input');
        const resultsSearchInput = document.getElementById('results-search-input');
        const clearSearchBtn = document.getElementById('clear-search-btn');
        const googleSearchBtn = document.getElementById('google-search-btn');
        const luckySearchBtn = document.getElementById('lucky-search-btn');
        const googleHomeView = document.getElementById('google-home-view');
        const searchResultsView = document.getElementById('search-results-view');
        const searchResultsContent = document.getElementById('search-results-content');
        
        // Google Custom Search API configuration
        // You would replace these with your actual API key and Custom Search Engine ID
        const GOOGLE_API_KEY = config.googleSearch.apiKey;
        const SEARCH_ENGINE_ID = config.googleSearch.searchEngineId;
        
        // Rate limiting configuration
        const RATE_LIMIT = 100; // Maximum number of searches in a time period
        const RATE_PERIOD = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        // Initialize or load rate limit data from localStorage
        let rateLimitData = {
            count: 0,
            resetTime: Date.now() + RATE_PERIOD,
            searches: []
        };
        
        // Load existing rate limit data if available
        function loadRateLimitData() {
            const savedData = localStorage.getItem('googleSearchRateLimit');
            if (savedData) {
                try {
                    rateLimitData = JSON.parse(savedData);
                    
                    // Reset if the period has expired
                    if (Date.now() > rateLimitData.resetTime) {
                        resetRateLimit();
                    }
                } catch (e) {
                    console.error('Error parsing rate limit data:', e);
                    resetRateLimit();
                }
            }
        }
        
        // Save rate limit data to localStorage
        function saveRateLimitData() {
            localStorage.setItem('googleSearchRateLimit', JSON.stringify(rateLimitData));
        }
        
        // Reset rate limit counter
        function resetRateLimit() {
            rateLimitData = {
                count: 0,
                resetTime: Date.now() + RATE_PERIOD,
                searches: []
            };
            saveRateLimitData();
        }
        
        // Check if rate limit is exceeded
        function isRateLimited() {
            return rateLimitData.count >= RATE_LIMIT;
        }
        
        // Update rate limit counter
        function updateRateLimit(query) {
            // If period has expired, reset
            if (Date.now() > rateLimitData.resetTime) {
                resetRateLimit();
            }
            
            // Increment counter and add search to history
            rateLimitData.count++;
            rateLimitData.searches.push({
                query: query,
                timestamp: Date.now()
            });
            
            // Save updated data
            saveRateLimitData();
        }
        
        // Get time until rate limit reset in human-readable format
        function getTimeUntilReset() {
            const timeLeft = rateLimitData.resetTime - Date.now();
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            
            return `${hours}h ${minutes}m`;
        }
        
        // Load rate limit data on initialization
        loadRateLimitData();
        
        // Function to perform a Google search with the Custom Search API
        function performSearch(searchTerm, isLucky = false) {
            console.log(`Performing search for: ${searchTerm}`);
            
            // Prepare the search term
            const query = searchTerm.trim();
            if (!query) return;
            
            // Check rate limit for searches
            if (window.RateLimiter && !window.RateLimiter.canPerformAction('searches')) {
                window.RateLimiter.showRateLimitError('searches', 'You have reached your daily search limit.');
                return;
            }
            
            // Show the search results view
            googleHomeView.style.display = 'none';
            searchResultsView.style.display = 'flex';
            
            // Update the search input in results view
            if (resultsSearchInput) {
                resultsSearchInput.value = query;
            }
            
            // Show loading indicator
            searchResultsContent.innerHTML = `
                <div class="search-loading">
                    <div class="loading-spinner"></div>
                    <div>Searching for "${query}"...</div>
                </div>
            `;
            
            // Decide whether to use real API or mock data
            if (GOOGLE_API_KEY === 'YOUR_API_KEY' || SEARCH_ENGINE_ID === 'YOUR_SEARCH_ENGINE_ID') {
                // If API credentials aren't set, use mock data
                console.log('Using mock data (API credentials not configured)');
                useMockSearch(query, isLucky);
            } else {
                // Check rate limit before making API call
                if (isRateLimited()) {
                    // Display rate limit exceeded message
                    searchResultsContent.innerHTML = `
                        <div class="rate-limit-exceeded">
                            <i class="fas fa-exclamation-circle"></i>
                            <h3>Search limit reached</h3>
                            <p>You've reached the daily search limit (${RATE_LIMIT} searches per day).</p>
                            <p>This limit helps prevent excessive API charges.</p>
                            <p>Limit will reset in: ${getTimeUntilReset()}</p>
                            <div class="rate-limit-searches">
                                <h4>Recent searches:</h4>
                                <ul>
                                    ${rateLimitData.searches.slice(-5).map(s => `
                                        <li>${s.query} <span>(${new Date(s.timestamp).toLocaleTimeString()})</span></li>
                                    `).join('')}
                                </ul>
                            </div>
                            <p class="rate-limit-note">Using mock data for this search.</p>
                        </div>
                    `;
                    
                    // Fall back to mock data
                    setTimeout(() => {
                        useMockSearch(query, isLucky);
                    }, 2000);
                    
                    return;
                }
                
                // Update rate limit counter
                updateRateLimit(query);
                
                // Record in new rate limiter
                if (window.RateLimiter) {
                    window.RateLimiter.recordAction('searches');
                }
                
                // Use the real Google API
                fetchGoogleResults(query, isLucky);
            }
        }
        
        // Function to fetch results from Google Custom Search API
        function fetchGoogleResults(query, isLucky) {
            // Construct the API URL
            const startIndex = 1; // Start with the first result
            const numResults = 10; // Number of results to return
            
            const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&start=${startIndex}&num=${numResults}`;
            
            // Show debug info in console
            console.log('Fetching from API URL:', apiUrl);
            console.log('API Key used:', GOOGLE_API_KEY.substring(0, 5) + '...');
            console.log('Search Engine ID:', SEARCH_ENGINE_ID);
            
            // Add debug info to results
            const debugNote = document.createElement('div');
            debugNote.style.padding = '10px';
            debugNote.style.margin = '10px';
            debugNote.style.backgroundColor = '#f0f0f0';
            debugNote.style.borderRadius = '5px';
            debugNote.style.fontSize = '12px';
            debugNote.innerHTML = `
                <strong>Debug Info:</strong><br>
                Query: "${query}"<br>
                API Call in Progress...
            `;
            searchResultsContent.appendChild(debugNote);
            
            fetch(apiUrl)
                .then(response => {
                    debugNote.innerHTML += `<br>Response Status: ${response.status} ${response.statusText}`;
                    
                    if (!response.ok) {
                        throw new Error(`API request failed: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('API Response:', data);
                    
                    // Update debug info
                    if (data.error) {
                        debugNote.innerHTML += `<br><span style="color:red">Error: ${data.error.code} - ${data.error.message}</span>`;
                        throw new Error(`API Error: ${data.error.message}`);
                    }
                    
                    // Show if we have results
                    debugNote.innerHTML += `<br>Results found: ${data.items ? data.items.length : 0}`;
                    
                    // Handle the API response
                    if (isLucky && data.items && data.items.length > 0) {
                        // For "I'm Feeling Lucky", display the first result
                        const firstResult = {
                            title: data.items[0].title,
                            url: data.items[0].link,
                            favicon: `https://www.google.com/s2/favicons?domain=${new URL(data.items[0].link).hostname}`,
                            description: data.items[0].snippet
                        };
                        displayLuckyResult(firstResult);
                    } else if (data.items && data.items.length > 0) {
                        // Process search results
                        const results = data.items.map(item => {
                            return {
                                title: item.title,
                                url: item.link,
                                favicon: item.pagemap?.cse_image?.[0]?.src || 
                                         `https://www.google.com/s2/favicons?domain=${new URL(item.link).hostname}`,
                                description: item.snippet
                            };
                        });
                        
                        // Remove debug note before showing results
                        searchResultsContent.removeChild(debugNote);
                        
                        // Display results with search count info
                        displaySearchResults(results, query, data.queries?.relatedSearch || [], true);
                    } else {
                        // No results found
                        debugNote.innerHTML += `<br><span style="color:orange">No items returned in response</span>`;
                        
                        searchResultsContent.innerHTML = `
                            <div class="no-results">
                                <p>No results found for "${query}"</p>
                                <p>Try different keywords or check your spelling</p>
                                <div style="font-size:12px; margin-top:20px; color:#666;">
                                    <p>Debug: API response received but no results were found.</p>
                                    <p>Search Engine ID: ${SEARCH_ENGINE_ID}</p>
                                    <p>Make sure your search engine is configured to search the entire web.</p>
                                </div>
                            </div>
                        `;
                    }
                })
                .catch(error => {
                    console.error('Error fetching search results:', error);
                    debugNote.innerHTML += `<br><span style="color:red">Error: ${error.message}</span>`;
                    
                    // Add more detailed error information
                    searchResultsContent.innerHTML = `
                        <div class="no-results">
                            <p>Error while searching for "${query}"</p>
                            <p>${error.message}</p>
                            <div style="font-size:12px; margin-top:20px; color:#666;">
                                <p>Possible issues:</p>
                                <ul style="text-align:left; padding-left:20px;">
                                    <li>API Key might be invalid or missing</li>
                                    <li>Search Engine ID might be incorrect</li>
                                    <li>API quota might be exceeded</li>
                                    <li>Network connectivity issues</li>
                                </ul>
                                <p>Using mock data as fallback...</p>
                            </div>
                        </div>
                    `;
                    
                    // Fall back to mock data on error after a delay
                    setTimeout(() => {
                        useMockSearch(query, isLucky);
                    }, 5000);
                });
        }
        
        // Function to use mock data when API is not configured or fails
        function useMockSearch(query, isLucky) {
            // Mock search results data - reusing our existing mock data
            const searchResults = {
                'web development': [
                    {
                        title: 'Web Development - MDN Web Docs',
                        url: 'https://developer.mozilla.org/en-US/docs/Learn',
                        favicon: 'https://developer.mozilla.org/favicon.ico',
                        description: 'Web development is the work involved in developing a website for the Internet or an intranet. Web development can range from developing a simple single static page of plain text to complex web applications.'
                    },
                    {
                        title: 'The Complete 2023 Web Development Bootcamp | Udemy',
                        url: 'https://www.udemy.com/course/the-complete-web-development-bootcamp/',
                        favicon: 'https://www.udemy.com/favicon.ico',
                        description: 'Become a Full-Stack Web Developer with just ONE course. HTML, CSS, Javascript, Node, React, MongoDB, Web3 and DApps.'
                    },
                    {
                        title: 'Web Development | freeCodeCamp.org',
                        url: 'https://www.freecodecamp.org/learn/responsive-web-design/',
                        favicon: 'https://www.freecodecamp.org/favicon.ico',
                        description: 'Learn the languages that developers use to build webpages: HTML for content, and CSS for design.'
                    },
                    {
                        title: 'Learn Web Development | Codecademy',
                        url: 'https://www.codecademy.com/learn/paths/web-development',
                        favicon: 'https://www.codecademy.com/favicon.ico',
                        description: 'Learn how to build websites with HTML, CSS, and JavaScript. This path will teach you the fundamentals of web development.'
                    }
                ],
                'javascript': [
                    {
                        title: 'JavaScript - MDN Web Docs',
                        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
                        favicon: 'https://developer.mozilla.org/favicon.ico',
                        description: 'JavaScript (JS) is a lightweight, interpreted, or just-in-time compiled programming language with first-class functions.'
                    },
                    {
                        title: 'Learn JavaScript | Codecademy',
                        url: 'https://www.codecademy.com/learn/introduction-to-javascript',
                        favicon: 'https://www.codecademy.com/favicon.ico',
                        description: 'JavaScript is a powerful, flexible, and fast programming language now being used for increasingly complex web development.'
                    },
                    {
                        title: 'W3Schools JavaScript Tutorial',
                        url: 'https://www.w3schools.com/js/default.asp',
                        favicon: 'https://www.w3schools.com/favicon.ico',
                        description: 'Well organized and easy to understand Web building tutorials with lots of examples of how to use HTML, CSS, JavaScript, SQL, Python, PHP, Bootstrap, Java, XML and more.'
                    }
                ],
                'react': [
                    {
                        title: 'React – A JavaScript library for building user interfaces',
                        url: 'https://reactjs.org/',
                        favicon: 'https://reactjs.org/favicon.ico',
                        description: 'React makes it painless to create interactive UIs. Design simple views for each state in your application, and React will efficiently update and render just the right components when your data changes.'
                    },
                    {
                        title: 'Getting Started – React',
                        url: 'https://reactjs.org/docs/getting-started.html',
                        favicon: 'https://reactjs.org/favicon.ico',
                        description: 'This page is an overview of the React documentation and related resources.'
                    },
                    {
                        title: 'React Tutorial: Learn React JS - Free 11-Hour Course',
                        url: 'https://scrimba.com/learn/learnreact',
                        favicon: 'https://scrimba.com/favicon.ico',
                        description: 'Learn React by building eight real-world projects and solving 140+ coding challenges. This free interactive course contains 11 hours of content.'
                    }
                ]
            };
            
            // Add Google APIs to our mock data
            searchResults['google api'] = [
                {
                    title: 'Google APIs | Google Cloud',
                    url: 'https://cloud.google.com/apis',
                    favicon: 'https://cloud.google.com/favicon.ico',
                    description: 'Google Cloud APIs are programmatic interfaces to Google Cloud services. They are a key part of Google Cloud, allowing you to easily add the power of Google Cloud to your applications.'
                },
                {
                    title: 'Custom Search JSON API | Google for Developers',
                    url: 'https://developers.google.com/custom-search/v1/overview',
                    favicon: 'https://developers.google.com/favicon.ico',
                    description: 'The Custom Search JSON API lets you develop websites and applications to retrieve and display search results from Google Custom Search programmatically.'
                },
                {
                    title: 'Google APIs Explorer',
                    url: 'https://developers.google.com/apis-explorer',
                    favicon: 'https://developers.google.com/favicon.ico',
                    description: 'Browse and try out Google APIs. Explorer provides method-level reference documentation for many Google APIs.'
                },
                {
                    title: 'Get Started with Google API | Google for Developers',
                    url: 'https://developers.google.com/docs/api/quickstart/js',
                    favicon: 'https://developers.google.com/favicon.ico',
                    description: 'Follow these step-by-step instructions to sign in with a Google account, create a Google API project, and obtain a client ID for use with the Google APIs.'
                }
            ];
            
            // Related searches for "google api"
            const relatedSearches = {
                'web development': ['web development course', 'web development tools', 'web development frameworks', 'frontend vs backend', 'learn html css'],
                'javascript': ['javascript tutorial', 'javascript vs python', 'javascript frameworks', 'es6 features', 'javascript DOM'],
                'react': ['react hooks', 'react vs angular', 'react native', 'redux tutorial', 'react components'],
                'google api': [
                    'google cloud api', 
                    'google maps api', 
                    'google search api', 
                    'how to use google api', 
                    'google api pricing'
                ]
            };
            
            // Generic search results for any query not in the predefined list
            const genericResults = [
                {
                    title: 'Search Results for your query',
                    url: 'https://google.com/search',
                    favicon: 'https://www.google.com/favicon.ico',
                    description: 'Find information about your search query from various trusted sources across the web.'
                },
                {
                    title: 'Wikipedia - The Free Encyclopedia',
                    url: 'https://en.wikipedia.org/wiki/',
                    favicon: 'https://en.wikipedia.org/favicon.ico',
                    description: 'Wikipedia is a free online encyclopedia, created and edited by volunteers around the world and hosted by the Wikimedia Foundation.'
                },
                {
                    title: 'Learn more about this topic - Educational Resources',
                    url: 'https://www.khanacademy.org/',
                    favicon: 'https://www.khanacademy.org/favicon.ico',
                    description: 'Khan Academy offers practice exercises, instructional videos, and a personalized learning dashboard that empower learners to study at their own pace.'
                }
            ];
            
            let results = [];
            let related = [];
            
            // If it's an "I'm Feeling Lucky" search, just take the first result
            if (isLucky && searchResults[query.toLowerCase()]) {
                // Redirect to the first result directly
                const firstResult = searchResults[query.toLowerCase()][0];
                displayLuckyResult(firstResult);
                return;
            }
            
            // Get regular search results
            if (searchResults[query.toLowerCase()]) {
                results = searchResults[query.toLowerCase()];
                related = relatedSearches[query.toLowerCase()] || [];
            } else {
                // For any other search term, use generic results
                results = genericResults.map(result => {
                    // Clone the result and customize it for the query
                    const customResult = {...result};
                    if (result.url.includes('wikipedia.org')) {
                        customResult.url = `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`;
                        customResult.title = `${query.charAt(0).toUpperCase() + query.slice(1)} - Wikipedia`;
                    } else if (result.url.includes('google.com')) {
                        customResult.url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                        customResult.title = `${query.charAt(0).toUpperCase() + query.slice(1)} - Google Search`;
                    }
                    customResult.description = customResult.description.replace('your search query', `"${query}"`);
                    return customResult;
                });
                
                // Generate random related searches
                related = ['how to ' + query, 'best ' + query, query + ' tutorial', query + ' examples', 'learn ' + query];
            }
            
            // Display the results
            displaySearchResults(results, query, related, false);
        }
        
        // Function to display search results in the iPhone interface
        function displaySearchResults(results, query, relatedSearches, isRealSearch = false) {
            // Clear previous results
            searchResultsContent.innerHTML = '';
            
            // Add search info with rate limit info if using real API
            const searchInfo = document.createElement('div');
            searchInfo.className = 'search-info';
            
            if (isRealSearch && GOOGLE_API_KEY !== config.googleSearch.firebaseApiKey) {
                searchInfo.innerHTML = `
                    About ${results.length * 10000000} results (0.${Math.floor(Math.random() * 90) + 10} seconds) 
                    <span class="rate-limit-info">
                        Searches: ${rateLimitData.count}/${RATE_LIMIT}
                        <span class="rate-limit-tooltip">
                            Resets in ${getTimeUntilReset()}
                        </span>
                    </span>
                `;
            } else {
                searchInfo.textContent = `About ${results.length * 10000000} results (0.${Math.floor(Math.random() * 90) + 10} seconds)`;
            }
            
            searchResultsContent.appendChild(searchInfo);
            
            // Add results
            results.forEach(result => {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                
                resultItem.innerHTML = `
                    <div class="result-url">
                        <img src="${result.favicon}" alt="favicon" onerror="this.src='https://www.google.com/favicon.ico';">
                        <span>${result.url.replace('https://', '')}</span>
                    </div>
                    <a href="${result.url}" class="result-title" target="_blank">${result.title}</a>
                    <div class="result-description">${result.description}</div>
                `;
                
                // Add click handler for the entire result item
                resultItem.addEventListener('click', (e) => {
                    // Don't trigger if they clicked directly on the anchor tag (it will handle itself)
                    if (e.target.tagName !== 'A' && !e.target.closest('a')) {
                        e.preventDefault();
                        
                        // Open the URL in a new tab
                        window.open(result.url, '_blank');
                        
                        // Display feedback when a result is clicked
                        displayResultFeedback(result);
                    }
                });
                
                // Add cursor style to show it's clickable
                resultItem.style.cursor = 'pointer';
                
                searchResultsContent.appendChild(resultItem);
            });
            
            // Add related searches if available
            if (relatedSearches && relatedSearches.length > 0) {
                const relatedSection = document.createElement('div');
                relatedSection.className = 'related-searches';
                
                relatedSection.innerHTML = `
                    <h3>Related searches</h3>
                    <div class="related-search-items"></div>
                `;
                
                const relatedItems = relatedSection.querySelector('.related-search-items');
                
                relatedSearches.forEach(term => {
                    const relatedItem = document.createElement('div');
                    relatedItem.className = 'related-search-item';
                    relatedItem.textContent = typeof term === 'string' ? term : term.query;
                    
                    // Add click handler for related searches
                    relatedItem.addEventListener('click', () => {
                        performSearch(relatedItem.textContent);
                    });
                    
                    relatedItems.appendChild(relatedItem);
                });
                
                searchResultsContent.appendChild(relatedSection);
            }
        }
        
        // Display a feedback message when a result is clicked
        function displayResultFeedback(result) {
            // Create a feedback element
            const feedback = document.createElement('div');
            feedback.className = 'safari-feedback';
            feedback.innerHTML = `<p>Opening: ${result.url}</p>`;
            safariApp.appendChild(feedback);
            
            // Remove feedback after animation
            setTimeout(() => {
                feedback.classList.add('fade-out');
                setTimeout(() => {
                    safariApp.removeChild(feedback);
                }, 500);
            }, 1000);
        }
        
        // Display a single result for "I'm Feeling Lucky" searches
        function displayLuckyResult(result) {
            // Clear previous results
            searchResultsContent.innerHTML = '';
            
            // Create a centered result display
            const luckyResult = document.createElement('div');
            luckyResult.className = 'lucky-result';
            luckyResult.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <img src="${result.favicon}" alt="favicon" style="width: 48px; height: 48px; margin-bottom: 15px;" onerror="this.src='https://www.google.com/favicon.ico';">
                    <a href="${result.url}" target="_blank" style="color: #1a0dab; text-decoration: none; font-size: 20px; display: block; margin-bottom: 10px;">
                        ${result.title}
                    </a>
                    <div style="font-size: 14px; color: #202124; margin-bottom: 20px;">${result.url.replace('https://', '')}</div>
                    <p style="font-size: 14px; color: #4d5156; line-height: 1.5;">${result.description}</p>
                    <div style="margin-top: 30px; font-size: 12px; color: #70757a;">
                        You've been taken directly to the first result for your search.
                    </div>
                </div>
            `;
            
            // Add click handler for the non-link parts
            luckyResult.addEventListener('click', (e) => {
                // Don't trigger if they clicked directly on the anchor tag
                if (e.target.tagName !== 'A' && !e.target.closest('a')) {
                    // Open the URL in a new tab
                    window.open(result.url, '_blank');
                    
                    // Display feedback
                    displayResultFeedback(result);
                }
            });
            
            // Add cursor style to show it's clickable
            luckyResult.style.cursor = 'pointer';
            
            searchResultsContent.appendChild(luckyResult);
            
            // Show the search results view
            googleHomeView.style.display = 'none';
            searchResultsView.style.display = 'flex';
            
            // Update the search input in results view
            if (resultsSearchInput) {
                resultsSearchInput.value = result.title.split(' - ')[0];
            }
        }
        
        // Add Enter key event listener for main search input
        if (safariSearchInput) {
            safariSearchInput.addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const query = this.value.trim();
                    if (query) {
                        performSearch(query);
                    }
                }
            });
        }

        // Add Enter key event listener for results search input
        if (resultsSearchInput) {
            resultsSearchInput.addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const query = this.value.trim();
                    if (query) {
                        performSearch(query);
                    }
                }
            });
        }

        if (googleSearchBtn) {
            googleSearchBtn.addEventListener('click', function() {
                performSearch(safariSearchInput.value);
            });
        }

        if (luckySearchBtn) {
            luckySearchBtn.addEventListener('click', function() {
                // I'm feeling lucky functionality
                window.open(`https://www.google.com/search?q=${safariSearchInput.value}&btnI=I`, '_blank');
            });
        }

        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', function() {
                resultsSearchInput.value = '';
                searchResultsContent.innerHTML = '';
                googleHomeView.style.display = 'block';
                searchResultsView.style.display = 'none';
            });
        }
    }

    // Mail app functionality
    const sendMailBtn = document.getElementById('send-mail-btn');
    const mailToInput = document.getElementById('mail-to');
    const mailSubjectInput = document.getElementById('mail-subject');
    const mailBodyInput = document.getElementById('mail-body');
    const mailFromInput = document.getElementById('mail-from');
    const mailNameInput = document.getElementById('mail-name');
    
    if (sendMailBtn) {
        console.log('Send mail button found:', sendMailBtn);
        sendMailBtn.addEventListener('click', () => {
            console.log('Send button clicked!');
            // Get email send count from localStorage
            let emailSendCount = parseInt(localStorage.getItem('emailSendCount') || '0');
            
            // Check if user has reached the send limit (3 emails)
            if (emailSendCount >= 3) {
                alert('You have reached the limit of 3 emails. Please try again later.');
                return;
            }
            
            const to = mailToInput.value.trim();
            const subject = mailSubjectInput.value.trim();
            const body = mailBodyInput.value.trim();
            const from = mailFromInput.value.trim();
            const name = mailNameInput ? mailNameInput.value.trim() : '';
            
            // Validate from field is not empty
            if (!from) {
                alert('Please enter your email address.');
                return;
            }
            
            // Email validation with more comprehensive regex
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(from)) {
                alert('Please enter a valid email address.');
                return;
            }
            
            // Create loading state for the button
            const originalBtnText = sendMailBtn.textContent;
            sendMailBtn.textContent = 'Sending...';
            sendMailBtn.disabled = true;
            
            // Prepare template parameters
            const templateParams = {
                to_name: 'Trush Patel',
                to_email: 'trushp097@gmail.com', // Fixed recipient email
                from_email: from,
                from_name: name || from,
                subject: subject,
                message: body
            };
            
            // Send email using EmailJS
            console.log('Attempting to send email with EmailJS...');
            console.log('Template params:', templateParams);
            console.log('Using service ID:', 'service_xtwz8cj');
            console.log('Using template ID:', 'template_ufl6l47');
            
            try {
                emailjs.send('service_xtwz8cj', 'template_ufl6l47', templateParams)
                    .then(function(response) {
                        console.log('SUCCESS!', response.status, response.text);
                        
                        // Increment and save the email count
                        emailSendCount++;
                        localStorage.setItem('emailSendCount', emailSendCount.toString());
                        
                        // Create a success feedback element
                        const mailContent = document.querySelector('.mail-content');
                        const successFeedback = document.createElement('div');
                        successFeedback.className = 'mail-success-feedback';
                        successFeedback.innerHTML = `
                            <div class="mail-close-button">
                                <i class="fas fa-times"></i>
                            </div>
                            <div class="mail-success-icon">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <h3>Email Sent</h3>
                            <p>Your message has been sent successfully</p>
                            <div class="mail-success-details">
                                <p><strong>From:</strong> ${name ? name + ' - ' : ''}${from}</p>
                                <p><strong>To:</strong> trushp097@gmail.com</p>
                                <p><strong>Subject:</strong> ${subject || '(No subject)'}</p>
                            </div>
                            <p class="mail-limit-info">You have sent ${emailSendCount} of 3 allowed emails.</p>
                        `;
                        
                        // Replace mail compose with success message
                        const mailCompose = document.querySelector('.mail-compose');
                        mailCompose.style.display = 'none';
                        mailContent.appendChild(successFeedback);
                        
                        // Add click event listener to close button
                        const closeButton = successFeedback.querySelector('.mail-close-button');
                        closeButton.addEventListener('click', () => {
                            // Reset form fields
                            if (mailNameInput) mailNameInput.value = '';
                            mailSubjectInput.value = '';
                            mailBodyInput.value = '';
                            
                            // Remove success message and restore compose form
                            mailContent.removeChild(successFeedback);
                            mailCompose.style.display = 'flex';
                            
                            // Reset button
                            sendMailBtn.textContent = originalBtnText;
                            sendMailBtn.disabled = false;
                        });
                        
                        // Reset button state (but don't remove popup)
                        sendMailBtn.textContent = originalBtnText;
                        sendMailBtn.disabled = false;
                    })
                    .catch(function(error) {
                        console.log('FAILED...', error);
                        
                        // Show error message
                        const mailContent = document.querySelector('.mail-content');
                        const errorFeedback = document.createElement('div');
                        errorFeedback.className = 'mail-error-feedback';
                        errorFeedback.innerHTML = `
                            <div class="mail-close-button">
                                <i class="fas fa-times"></i>
                            </div>
                            <div class="mail-error-icon">
                                <i class="fas fa-exclamation-circle"></i>
                            </div>
                            <h3>Sending Failed</h3>
                            <p>There was a problem sending your message</p>
                            <div class="mail-error-details">
                                <p><strong>From:</strong> ${name ? name + ' - ' : ''}${from}</p>
                                <p><strong>To:</strong> trushp097@gmail.com</p>
                                <p class="mail-error-note">Please check your internet connection and try again.</p>
                            </div>
                            <button class="mail-try-again-btn">Try Again</button>
                        `;
                        
                        // Replace mail compose with error message
                        const mailCompose = document.querySelector('.mail-compose');
                        mailCompose.style.display = 'none';
                        mailContent.appendChild(errorFeedback);
                        
                        // Add event listener to try again button
                        const tryAgainBtn = errorFeedback.querySelector('.mail-try-again-btn');
                        tryAgainBtn.addEventListener('click', () => {
                            // Remove error message and restore compose form
                            mailContent.removeChild(errorFeedback);
                            mailCompose.style.display = 'flex';
                            
                            // Reset button
                            sendMailBtn.textContent = originalBtnText;
                            sendMailBtn.disabled = false;
                        });
                        
                        // Add event listener to close button
                        const closeButton = errorFeedback.querySelector('.mail-close-button');
                        closeButton.addEventListener('click', () => {
                            // Remove error message and restore compose form
                            mailContent.removeChild(errorFeedback);
                            mailCompose.style.display = 'flex';
                            
                            // Reset button
                            sendMailBtn.textContent = originalBtnText;
                            sendMailBtn.disabled = false;
                        });
                    });
            } catch (error) {
                console.error('Error sending email:', error);
                alert('There was an error sending your email. Please try again later.');
            }
        });
    }

    // Mail app draft saving functionality
    function initializeMailAppDraftSaving() {
        const fromInput = document.getElementById('mail-from');
        const subjectInput = document.getElementById('mail-subject');
        const bodyInput = document.getElementById('mail-body');
        const sendButton = document.getElementById('send-mail-btn');
        
        // Check for email send limit and display message if needed
        function checkEmailSendLimit() {
            let emailSendCount = parseInt(localStorage.getItem('emailSendCount') || '0');
            if (emailSendCount >= 3) {
                const mailCompose = document.querySelector('.mail-compose');
                if (mailCompose) {
                    const limitMessage = document.createElement('div');
                    limitMessage.className = 'mail-limit-message';
                    limitMessage.innerHTML = `
                        <div class="mail-error-icon">
                            <i class="fas fa-exclamation-circle"></i>
                        </div>
                        <h3>Email Limit Reached</h3>
                        <p>You have reached the limit of 3 emails.</p>
                        <button class="mail-reset-limit-btn">Reset Limit</button>
                    `;
                    
                    // Replace mail compose with limit message
                    mailCompose.style.display = 'none';
                    const mailContent = document.querySelector('.mail-content');
                    mailContent.appendChild(limitMessage);
                    
                    // Add reset button functionality (for demo purposes only)
                    const resetButton = limitMessage.querySelector('.mail-reset-limit-btn');
                    resetButton.addEventListener('click', () => {
                        localStorage.setItem('emailSendCount', '0');
                        mailContent.removeChild(limitMessage);
                        mailCompose.style.display = 'flex';
                    });
                }
            }
        }
        
        // Load saved draft when page loads
        function loadSavedDraft() {
            if (fromInput && subjectInput && bodyInput) {
                const savedDraft = JSON.parse(localStorage.getItem('mailAppDraft') || '{}');
                
                if (savedDraft.from) fromInput.value = savedDraft.from;
                if (savedDraft.subject) subjectInput.value = savedDraft.subject;
                if (savedDraft.body) bodyInput.value = savedDraft.body;
            }
            
            // Check email send limit
            checkEmailSendLimit();
        }
        
        // Save draft as user types
        function saveDraft() {
            if (fromInput && subjectInput && bodyInput) {
                const draft = {
                    from: fromInput.value,
                    subject: subjectInput.value,
                    body: bodyInput.value,
                    lastSaved: new Date().toISOString()
                };
                
                localStorage.setItem('mailAppDraft', JSON.stringify(draft));
            }
        }
        
        // Clear draft when email is sent
        function clearDraft() {
            localStorage.removeItem('mailAppDraft');
        }
        
        // Add event listeners
        if (fromInput && subjectInput && bodyInput && sendButton) {
            // Save on input
            fromInput.addEventListener('input', saveDraft);
            subjectInput.addEventListener('input', saveDraft);
            bodyInput.addEventListener('input', saveDraft);
            
            // Clear on send
            sendButton.addEventListener('click', clearDraft);
            
            // Load on page load
            loadSavedDraft();
        }
    }

    // Initialize mail draft saving when document is ready
    document.addEventListener('DOMContentLoaded', function() {
        initializeMailAppDraftSaving();
    });

    // Messages-specific logic - this is handled in updateContentDisplay now
    // The main initialization happens when the app is opened through updateContentDisplay

    // Add these styles dynamically to avoid modifying external files
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .message-sending-indicator {
            text-align: center;
            font-size: 12px;
            color: #8e8e93;
            margin: 5px 0;
            font-style: italic;
        }
        
        .message-delivery-status {
            text-align: right;
            font-size: 12px;
            color: #34c759;
            margin: 5px 0;
            font-style: italic;
        }
        
        .message-error-status {
            text-align: right;
            font-size: 12px;
            color: #ff3b30;
            margin: 5px 0;
            font-style: italic;
        }
    `;
    document.head.appendChild(styleElement);

    // Handle messages input and send button
    function setupMessagesInput() {
        const messagesInput = document.querySelector('.messages-input');
        const messagesContent = document.querySelector('.messages-content');
        const sendButton = document.querySelector('.messages-send-btn');
        const messagesInputField = document.querySelector('.messages-input-field');
        const attachmentBtn = document.querySelector('.attachment-btn');

        if (!messagesInput || !messagesContent || !sendButton) {
            console.error('Missing required message elements');
            return;
        }

        // Constants for file upload limits
        const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
        const MAX_UPLOADS_PER_DAY = 3;
        const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];

        // Get user's daily upload count from localStorage
        function getUserUploads() {
            const today = new Date().toDateString();
            const uploads = JSON.parse(localStorage.getItem('userUploads') || '{}');
            
            // Clear old dates
            for (let date in uploads) {
                if (date !== today) {
                    delete uploads[date];
                }
            }
            
            uploads[today] = uploads[today] || 0;
            localStorage.setItem('userUploads', JSON.stringify(uploads));
            return uploads[today];
        }

        // Increment user's upload count
        function incrementUserUploads() {
            const today = new Date().toDateString();
            const uploads = JSON.parse(localStorage.getItem('userUploads') || '{}');
            uploads[today] = (uploads[today] || 0) + 1;
            localStorage.setItem('userUploads', JSON.stringify(uploads));
        }

        function handleAttachment() {
            const currentUploads = getUserUploads();
            
            if (currentUploads >= MAX_UPLOADS_PER_DAY) {
                alert(`You've reached your daily upload limit of ${MAX_UPLOADS_PER_DAY} files. Please try again tomorrow.`);
                return;
            }
            
            // Check all attachment-related rate limits
            if (!window.RateLimiter.canPerformAction('attachments')) {
                window.RateLimiter.showRateLimitError('attachments', 'You have reached your daily attachment limit.');
                return;
            }
            
            if (!window.RateLimiter.canPerformAction('totalMessages')) {
                window.RateLimiter.showRateLimitError('totalMessages', 'You have reached your daily message limit.');
                return;
            }
            
            // Check if we're close to storage limit
            const currentStorage = window.RateLimiter.getCurrentUsage('totalStorage');
            const remainingStorage = window.RateLimiter.getRemainingAllowance('totalStorage');
            
            if (remainingStorage < 1024 * 1024) { // Less than 1MB remaining
                const currentMB = (currentStorage / (1024 * 1024)).toFixed(1);
                const remainingKB = (remainingStorage / 1024).toFixed(0);
                alert(`Storage limit warning!\n\nYou've used ${currentMB}MB of your 20MB daily limit.\nOnly ${remainingKB}KB remaining.\n\nConsider waiting until tomorrow when your limit resets.`);
                return;
            }
            
            // If no storage remaining at all, prevent file selection
            if (remainingStorage <= 0) {
                const currentMB = (currentStorage / (1024 * 1024)).toFixed(1);
                const timeUntilReset = window.RateLimiter.getTimeUntilReset('totalStorage');
                const hoursUntilReset = Math.ceil(timeUntilReset / (1000 * 60 * 60));
                alert(`Storage limit reached!\n\nYou've used all ${currentMB}MB of your daily storage allowance.\n\nYour limit will reset in ${hoursUntilReset} hours.`);
                return;
            }

            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = ALLOWED_FILE_TYPES.join(',');
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);

            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Validate file type
                if (!ALLOWED_FILE_TYPES.includes(file.type)) {
                    alert('Invalid file type. Please upload an image (JPG, PNG, GIF) or PDF file.');
                    return;
                }

                // Validate file size
                if (file.size > MAX_FILE_SIZE) {
                    alert('File is too large. Maximum size is 2MB.');
                    return;
                }

                try {
                    // Create preview container
                    const previewContainer = document.createElement('div');
                    previewContainer.className = 'attachment-preview';

                    if (file.type.startsWith('image/')) {
                        // Image preview
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            previewContainer.innerHTML = `
                                <div class="preview-content">
                                    <img src="${e.target.result}" alt="Preview">
                                    <button class="remove-attachment"><i class="fas fa-times"></i></button>
                                </div>
                                <div class="file-info">${file.name} (${(file.size / 1024).toFixed(1)} KB)</div>
                            `;
                        };
                        reader.readAsDataURL(file);
                    } else {
                        // PDF preview
                        previewContainer.innerHTML = `
                            <div class="preview-content">
                                <i class="fas fa-file-pdf"></i>
                                <button class="remove-attachment"><i class="fas fa-times"></i></button>
                            </div>
                            <div class="file-info">${file.name} (${(file.size / 1024).toFixed(1)} KB)</div>
                        `;
                    }

                    // Remove existing preview if any
                    const existingPreview = messagesInputField.querySelector('.attachment-preview');
                    if (existingPreview) {
                        existingPreview.remove();
                    }

                    messagesInputField.insertBefore(previewContainer, messagesInput);

                    // Handle remove button
                    const removeBtn = previewContainer.querySelector('.remove-attachment');
                    removeBtn.addEventListener('click', () => {
                        previewContainer.remove();
                    });

                    incrementUserUploads();
                    
                    // Record rate limit usage
                    window.RateLimiter.recordAction('attachments');
                    window.RateLimiter.recordAction('totalStorage', { size: file.size });
                    
                    // Update storage usage bar
                    if (window.updateStorageUsageBar) {
                        window.updateStorageUsageBar();
                    }
                } catch (error) {
                    console.error('Error handling attachment:', error);
                    alert('Failed to process attachment. Please try again.');
                } finally {
                    document.body.removeChild(fileInput);
                }
            });

            fileInput.click();
        }

        function sendMessage() {
            const text = messagesInput.value.trim();
            // >>> ADDED: intercept SignOut command to log the user out and show sign-in prompt <<<
            if (text.toLowerCase() === 'signout') {
                // Clear the input box so the command isn't sent as a regular message
                messagesInput.value = '';
                // Clean up any active chat listener
                if (window.chatUnsubscribe) {
                    try { window.chatUnsubscribe(); } catch (e) { console.error(e); }
                }
                window.chatInitialized = false;
                // Sign the user out (if currently authenticated)
                if (window.firebase && firebase.auth && firebase.auth().currentUser) {
                    firebase.auth().signOut().catch(err => console.error('Sign-out error:', err));
                }
                // Re-prompt the user to sign in
                const messagesAppElem = document.getElementById('messages-app');
                if (messagesAppElem) {
                    showGoogleSignInPrompt(messagesAppElem, initializeChat);
                }
                return; // Do not send the command as a message
            }
            const attachmentPreview = messagesInputField.querySelector('.attachment-preview');
            
            if (!text && !attachmentPreview) return;

            const messageContainer = document.createElement('div');
            messageContainer.className = 'message-container';
            
            const message = document.createElement('div');
            message.className = 'message message-sent';

            if (attachmentPreview) {
                const previewContent = attachmentPreview.querySelector('.preview-content');
                if (previewContent) {
                    const clone = previewContent.cloneNode(true);
                    const removeBtn = clone.querySelector('.remove-attachment');
                    if (removeBtn) removeBtn.remove();
                    message.appendChild(clone);
                }
            }
            
            if (text) {
                const textDiv = document.createElement('div');
                textDiv.className = 'message-text';
                textDiv.textContent = text;
                message.appendChild(textDiv);
            }
            
            const timestamp = document.createElement('div');
            timestamp.className = 'time-stamp';
            const now = new Date();
            timestamp.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            messageContainer.appendChild(message);
            messagesContent.appendChild(messageContainer);
            messagesContent.appendChild(timestamp);
            
            // Clear input and attachment preview
            messagesInput.value = '';
            if (attachmentPreview) {
                attachmentPreview.remove();
            }
            messagesInputField.classList.remove('has-content');
            messagesContent.scrollTop = messagesContent.scrollHeight;
        }

        // Show/hide send button based on input
        messagesInput.addEventListener('input', () => {
            if (messagesInput.value.trim() || messagesInputField.querySelector('.attachment-preview')) {
                messagesInputField.classList.add('has-content');
            } else {
                messagesInputField.classList.remove('has-content');
            }
            
            // Update rate limit indicator
            updateRateLimitIndicator();
        });
        
        // Function to update rate limit indicator
        function updateRateLimitIndicator() {
            if (!window.RateLimiter) return;
            
            const messagesRemaining = window.RateLimiter.getRemainingAllowance('messages');
            const attachmentsRemaining = window.RateLimiter.getRemainingAllowance('attachments');
            const storageRemaining = window.RateLimiter.getRemainingAllowance('totalStorage');
            const storageMB = (storageRemaining / (1024 * 1024)).toFixed(1);
            
            // Remove existing indicator
            const existingIndicator = document.querySelector('.rate-limit-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            // Add indicator if limits are low
            if (messagesRemaining < 10 || attachmentsRemaining < 3 || storageRemaining < 5 * 1024 * 1024) {
                const indicator = document.createElement('div');
                indicator.className = 'rate-limit-indicator';
                indicator.style.cssText = `
                    position: absolute;
                    top: -25px;
                    right: 10px;
                    font-size: 11px;
                    color: #ff9500;
                    background: rgba(255, 149, 0, 0.1);
                    padding: 3px 8px;
                    border-radius: 10px;
                `;
                
                const parts = [];
                if (messagesRemaining < 10) parts.push(`${messagesRemaining} msgs`);
                if (attachmentsRemaining < 3) parts.push(`${attachmentsRemaining} files`);
                if (storageRemaining < 5 * 1024 * 1024) parts.push(`${storageMB}MB`);
                
                indicator.textContent = `Remaining: ${parts.join(', ')}`;
                messagesInputField.appendChild(indicator);
            }
        }
        
        // Update indicator on load
        updateRateLimitIndicator();
        
        // Add storage usage bar
        function updateStorageUsageBar() {
            if (!window.RateLimiter) return;
            
            // Remove existing bar if any
            const existingBar = document.querySelector('.storage-usage-bar-container');
            if (existingBar) {
                existingBar.remove();
            }
            
            const currentStorage = window.RateLimiter.getCurrentUsage('totalStorage');
            const maxStorage = window.RateLimiter.limits.totalStorage.max;
            const percentage = (currentStorage / maxStorage) * 100;
            const currentMB = (currentStorage / (1024 * 1024)).toFixed(1);
            const maxMB = (maxStorage / (1024 * 1024)).toFixed(0);
            
            // Only show if user has used some storage
            if (currentStorage > 0) {
                const barContainer = document.createElement('div');
                barContainer.className = 'storage-usage-bar-container';
                barContainer.style.cssText = `
                    position: absolute;
                    bottom: 60px;
                    left: 10px;
                    right: 10px;
                    background: rgba(0, 0, 0, 0.05);
                    border-radius: 8px;
                    padding: 8px;
                    font-size: 11px;
                `;
                
                barContainer.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="color: #666;">Storage Used</span>
                        <span style="color: #000; font-weight: 500;">${currentMB}MB / ${maxMB}MB</span>
                    </div>
                    <div style="background: #e0e0e0; height: 4px; border-radius: 2px; overflow: hidden;">
                        <div style="
                            background: ${percentage > 80 ? '#ff3b30' : percentage > 60 ? '#ff9500' : '#34c759'};
                            width: ${percentage}%;
                            height: 100%;
                            transition: width 0.3s ease;
                        "></div>
                    </div>
                `;
                
                const messagesInputArea = document.querySelector('.messages-input-area');
                if (messagesInputArea) {
                    messagesInputArea.appendChild(barContainer);
                }
            }
        }
        
        // Make it globally accessible
        window.updateStorageUsageBar = updateStorageUsageBar;
        
        // Update storage bar on load and after each upload
        updateStorageUsageBar();

        // Handle Enter key press
        messagesInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Handle send button click
        sendButton.addEventListener('click', sendMessage);

        // Handle attachment button click
        if (attachmentBtn) {
            attachmentBtn.addEventListener('click', handleAttachment);
        }
    }

    // Add this to your DOMContentLoaded event listener
    document.addEventListener('DOMContentLoaded', () => {
        // ... existing code ...
        setupMessagesInput();
    });

    // Add notification styles
    const notificationStyles = `
        .ios-notification {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: 14px;
            padding: 12px 16px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            max-width: 90%;
            width: 320px;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            animation: slideDown 0.3s ease-out;
            cursor: pointer;
        }

        .ios-notification .notification-icon {
            width: 32px;
            height: 32px;
            background-color: #007AFF;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .ios-notification .notification-content {
            flex: 1;
            min-width: 0;
        }

        .ios-notification .notification-title {
            font-weight: 600;
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .ios-notification .notification-message {
            opacity: 0.9;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        @keyframes slideDown {
            from {
                transform: translate(-50%, -100%);
                opacity: 0;
            }
            to {
                transform: translate(-50%, 0);
                opacity: 1;
            }
        }

        @keyframes slideUp {
            from {
                transform: translate(-50%, 0);
                opacity: 1;
            }
            to {
                transform: translate(-50%, -100%);
                opacity: 0;
            }
        }

        .ios-notification.hiding {
            animation: slideUp 0.3s ease-in forwards;
        }
    `;

    // Add styles to document
    const notificationStyleElement = document.createElement('style');
    notificationStyleElement.textContent = notificationStyles;
    document.head.appendChild(notificationStyleElement);

    // Function to show iOS-style notification
    function showIOSNotification(message) {
        console.log('Attempting to show notification:', message);
        
        // Remove any existing notification
        const existingNotification = document.querySelector('.ios-notification');
        if (existingNotification) {
            console.log('Removing existing notification');
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'ios-notification';
        
        // Get current time
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const timeString = `${displayHours}:${minutes} ${ampm}`;

        // Create notification content
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-user" style="color: white;"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">Trush Patel</div>
                <div class="notification-message">${message}</div>
            </div>
        `;

        // Add click handler to focus chat
        notification.addEventListener('click', () => {
            console.log('Notification clicked');
            const messagesApp = document.getElementById('messages-app');
            if (messagesApp) {
                messagesApp.scrollIntoView({ behavior: 'smooth' });
                // Highlight the chat briefly
                messagesApp.style.transition = 'background-color 0.3s ease';
                messagesApp.style.backgroundColor = 'rgba(0, 122, 255, 0.1)';
                setTimeout(() => {
                    messagesApp.style.backgroundColor = '';
                }, 1000);
            }
            notification.remove();
        });

        // Add to document
        document.body.appendChild(notification);
        console.log('Notification added to document');

        // Auto-hide after 4 seconds
        setTimeout(() => {
            console.log('Auto-hiding notification');
            notification.classList.add('hiding');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                    console.log('Notification removed');
                }
            }, 300);
        }, 4000);
    }

    // Modify the setupChatListener function to show notifications for new admin messages
    function setupChatListener(chatRef, messagesContent) {
        // Track seen messages to prevent duplicates
        const seenMessageIds = new Set();
        
        // Clear any existing messages first to prevent duplicates
        messagesContent.innerHTML = '';
        
        // Show welcome message
        showWelcomeMessage(messagesContent);
        
        // Also listen for deletion events on the user document
        const userId = getChatUserId();
        const userStatusRef = firebase.firestore().collection('users').doc(userId);
        const userStatusUnsubscribe = userStatusRef.onSnapshot(doc => {
            if (doc.exists && doc.data().chatDeleted) {
                // Chat was deleted by admin while user was active
                clearChatHistory();
                
                // Reset the deleted flag
                userStatusRef.update({
                    chatDeleted: false
                }).catch(err => console.error("Error resetting chat deleted flag:", err));
                
                // Show deletion message
                messagesContent.innerHTML = '';
                showChatDeletedMessage(messagesContent);
            }
        }, error => {
            console.error("Error listening for chat deletion:", error);
        });
        
        // Mark previous messages as delivered
        chatRef.where('sender', '==', 'user')
            .where('delivered', '==', false)
            .get()
            .then(snapshot => {
                const batch = firebase.firestore().batch();
                snapshot.forEach(doc => {
                    batch.update(doc.ref, { delivered: true });
                });
                return batch.commit();
            })
            .catch(error => {
                console.error("Error marking messages as delivered:", error);
            });
        
        // Listen for new messages
        const messagesUnsubscribe = chatRef.orderBy('timestamp', 'asc').onSnapshot(snapshot => {
            // Process all messages to ensure proper ordering
            const allMessages = [];
            let userMessages = [];
            
            snapshot.forEach(doc => {
                const messageData = doc.data();
                const messageId = doc.id;
                
                if (messageData && messageData.timestamp) {
                    allMessages.push({
                        id: messageId,
                        data: messageData
                    });
                    
                    // Track user messages for status updates
                    if (messageData.sender === 'user') {
                        const timestamp = messageData.timestamp ? 
                            (messageData.timestamp.toDate ? messageData.timestamp.toDate().getTime() : new Date(messageData.timestamp).getTime()) 
                            : Date.now();
                        
                        userMessages.push({
                            id: messageId,
                            data: messageData,
                            timestamp: timestamp
                        });
                    }
                }
            });
            
            // Clear and re-render all messages
            messagesContent.innerHTML = '';
            showWelcomeMessage(messagesContent);
            
            // Display all messages
            allMessages.forEach(message => {
                const messageId = message.id;
                const messageData = message.data;
                
                // Mark admin messages as seen if not already
                if (messageData.sender === 'admin' && !messageData.seen && !seenMessageIds.has(messageId)) {
                    chatRef.doc(messageId).update({ 
                        seen: true,
                        seenAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(error => console.error("Error marking message as seen:", error));
                    
                    // Show notification for new admin messages
                    console.log('New admin message received:', messageData);
                    const messageText = messageData.text || 
                        (messageData.imageUrl ? '📷 Image' : 
                        (messageData.fileUrl ? '📎 File attachment' : 'New message'));
                    
                    showIOSNotification(messageText);
                }
                
                // Mark user messages as delivered if not already
                if (messageData.sender === 'user' && !messageData.delivered) {
                    chatRef.doc(messageId).update({ delivered: true })
                        .catch(error => console.error("Error marking message as delivered:", error));
                }
                
                // Add to seen set
                seenMessageIds.add(messageId);
                
                // Display the message
                displayMessage(messagesContent, messageData, messageId, false);
            });
            
            // Sort user messages by timestamp
            userMessages.sort((a, b) => a.timestamp - b.timestamp);
            
            // Find latest read message
            let latestReadMessage = null;
            for (let i = userMessages.length - 1; i >= 0; i--) {
                if (userMessages[i].data.seen) {
                    latestReadMessage = userMessages[i];
                    break;
                }
            }
            
            // Find latest delivered message (if no read message)
            let latestDeliveredMessage = null;
            if (!latestReadMessage) {
                for (let i = userMessages.length - 1; i >= 0; i--) {
                    if (userMessages[i].data.delivered) {
                        latestDeliveredMessage = userMessages[i];
                        break;
                    }
                }
            }
            
            // Update status displays
            updateMessageStatuses(messagesContent, latestReadMessage, latestDeliveredMessage);
            
            // Scroll to bottom after rendering
            setTimeout(() => scrollToBottom(messagesContent), 100);
        }, error => {
            console.error("Error loading messages:", error);
            showChatError("Failed to load messages. Please try again later.");
        });
        
        // Return a combined unsubscribe function
        return function() {
            userStatusUnsubscribe();
            messagesUnsubscribe();
        };
    }

    // ... existing code ...
});

// Update time in status bar
function updateTime() {
    const timeElement = document.querySelector('.time');
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    timeElement.textContent = `${hours}:${minutes}`;
}

// Change iPhone background
function changeIphoneBackground() {
    const iphoneScreen = document.querySelector('.iphone-screen');
    const themes = [
        'minimal,dark,tech',
        'abstract,dark,tech',
        'gradient,blue,tech',
        'digital,minimal',
        'abstract,technology,blue'
    ];
    
    // Select a random theme
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    const timestamp = new Date().getTime(); // Add timestamp to prevent caching
    
    // Create new background image URL with random theme
    const newBgUrl = `https://source.unsplash.com/random/1080x1920/?${randomTheme}&t=${timestamp}`;
    
    // Set the new background image with a fade effect
    const tempImg = new Image();
    tempImg.src = newBgUrl;
    
    tempImg.onload = function() {
        iphoneScreen.style.backgroundImage = `url(${newBgUrl})`;
        iphoneScreen.classList.add('bg-transition');
        
        setTimeout(() => {
            iphoneScreen.classList.remove('bg-transition');
        }, 1000);
    };
}

// Update content based on opened app
function updateContentDisplay(appName) {
    // Clean up any previous chat initialization
    if (window.chatInitialized && window.chatUnsubscribe && appName !== 'messages') {
        window.chatUnsubscribe();
        window.chatInitialized = false;
        console.log("Cleaned up previous chat initialization");
    }

    // Handle app-specific content display logic
    if (appName === 'safari') {
        // Safari-specific logic already handled
    } else if (appName === 'mail') {
        // Mail-specific logic
        const mailApp = document.getElementById('mail-app');
        if (mailApp) {
            // Load existing emails from localStorage
            // (Mail app logic would be here)
        }
    } else if (appName === 'messages') {
        // Messages-specific logic
        const messagesApp = document.getElementById('messages-app');
        if (messagesApp) {
            // Update the timestamp with current time
            const timestamp = document.getElementById('messages-timestamp');
            if (timestamp) {
                const now = new Date();
                const hours = now.getHours();
                const minutes = now.getMinutes().toString().padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                const displayHours = hours % 12 || 12; // Convert to 12-hour format
                timestamp.textContent = `Today, ${displayHours}:${minutes} ${ampm}`;
            }
            
            // Always check authentication status and show sign-in if needed
            checkAuthAndInitializeChat(messagesApp);
            
            // Set up export button
            const exportBtn = document.getElementById('export-chat-btn');
            if (exportBtn) {
                exportBtn.addEventListener('click', exportChatAsText);
            }
        }
    } else if (appName === 'skills') {
        // Initialize animations for the skills app
        const skillLevels = document.querySelectorAll('.skill-level');
        skillLevels.forEach(skill => {
            // Reset animation
            skill.style.animation = 'none';
            skill.offsetHeight; // Trigger reflow
            skill.style.animation = 'fillBar 1.5s ease-out';
        });
    }
    // Add more else-if blocks for other apps that need special handling
}

// Function to go back to home screen when black bar is clicked
function goToHomeScreen() {
    console.log("Home indicator clicked - returning to home screen");
    
    const appScreens = document.querySelectorAll('.app-screen');
    const homeScreen = document.getElementById('home-screen');
    
    appScreens.forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Make sure the home screen is displayed
    homeScreen.style.display = 'flex';
    
    // Reset status bar to transparent for home screen
    const statusBar = document.querySelector('.status-bar');
    statusBar.classList.remove('in-app');
    statusBar.classList.remove('light-mode');
}

// Function to generate or retrieve a user ID for chat
function getChatUserId() {
    // If the visitor is authenticated with Google, use their Firebase UID
    if (window.firebase && firebase.auth && firebase.auth().currentUser) {
        return firebase.auth().currentUser.uid;
    }
    // Fallback to anonymous session id stored in localStorage
    let userId = localStorage.getItem('chat_user_id');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('chat_user_id', userId);
    }
    return userId;
}

// Function to get display name for admin preview
function getChatDisplayName() {
    if (window.firebase && firebase.auth && firebase.auth().currentUser) {
        const user = firebase.auth().currentUser;
        return user.displayName || user.email || user.uid;
    }
    return getChatUserId();
}

// Function to save chat history
function saveChatHistory(messages) {
    const userId = getChatUserId();
    localStorage.setItem(`chat_history_${userId}`, JSON.stringify(messages));
}

// Function to load chat history
function loadChatHistory() {
    const userId = getChatUserId();
    const savedChat = localStorage.getItem(`chat_history_${userId}`);
    return savedChat ? JSON.parse(savedChat) : [];
}



// Function for the subtle bounce animation of the home indicator
function bounce(element) {
    let start = 0;
    const duration = 600; // total animation time in ms
    const bounceAmount = 2; // how many pixels to bounce
    
    function bounceStep(timestamp) {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        
        if (progress < duration) {
            // Simple sine wave for a natural bounce
            const bounce = Math.sin(progress / duration * Math.PI * 2) * bounceAmount;
            element.style.transform = `translateX(-50%) translateY(${bounce}px)`;
            
            requestAnimationFrame(bounceStep);
        } else {
            // Reset position when done
            element.style.transform = 'translateX(-50%)';
        }
    }
    
    requestAnimationFrame(bounceStep);
}

// Function to check authentication and initialize chat
function checkAuthAndInitializeChat(messagesApp) {
    // Initialize Firebase if not already done
    if (!window.firebase) {
        if (typeof firebase !== 'undefined') {
            const firebaseConfig = config.firebase;
            
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            window.firebase = firebase;
        } else {
            console.error("Firebase SDK not loaded");
            showChatError("Chat system unavailable. Please refresh the page.");
            return;
        }
    }
    
    // Setup admin status listener for ALL users (signed in or out)
    const db = firebase.firestore();
    const adminStatusRef = db.collection('admin').doc('status');
    setupAdminStatusListener(adminStatusRef);
    
    // Check current auth state immediately
    const currentUser = firebase.auth().currentUser;
    if (currentUser) {
        // User is already signed in, initialize chat immediately
        console.log('User already authenticated:', currentUser.displayName || currentUser.email);
        initializeChat();
    } else {
        // User is not signed in, show sign-in prompt
        console.log('User not authenticated, showing sign-in prompt');
        showGoogleSignInPrompt(messagesApp, () => {
            initializeChat();
        });
    }
    
    // Also listen for auth state changes (but only once)
    if (!window.authStateListenerAttached) {
        window.authStateListenerAttached = true;
        firebase.auth().onAuthStateChanged((user) => {
            if (user && !window.chatInitialized) {
                // User signed in and chat not yet initialized
                console.log('Auth state changed - user signed in:', user.displayName || user.email);
                initializeChat();
            } else if (!user && window.chatInitialized) {
                // User signed out and chat was initialized
                console.log('Auth state changed - user signed out');
                if (window.chatUnsubscribe) {
                    window.chatUnsubscribe();
                }
                window.chatInitialized = false;
                window.authStateListenerAttached = false;
                
                // Clear messages content and show sign-in prompt again
                const messagesContent = document.querySelector('.messages-content');
                if (messagesContent) {
                    messagesContent.innerHTML = '';
                }
                showGoogleSignInPrompt(messagesApp, () => {
                    initializeChat();
                });
            }
        });
    }
}

// Function to initialize the chat system with Firebase
function initializeChat() {
    // Check if chat is already initialized to prevent duplicate listeners
    if (window.chatInitialized) {
        console.log("Chat already initialized, skipping");
        return;
    }
    
    const userId = getChatUserId();
    
    // Initialize Firebase if not already done
    if (!window.firebase) {
        // Initialize Firebase if it's available via script tags but not started
        if (typeof firebase !== 'undefined') {
            const firebaseConfig = config.firebase;
            
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            window.firebase = firebase;
        } else {
            console.error("Firebase SDK not loaded");
            showChatError("Chat system unavailable. Please refresh the page.");
            return;
        }
    }
    
    const messagesContent = document.querySelector('.messages-content');
    const messageInput = document.querySelector('.messages-input');
    const sendButton = document.querySelector('.messages-send-btn');
    
    if (!messagesContent || !messageInput || !sendButton) {
        console.error("Chat UI elements not found");
        return;
    }
    
    // Set up Firestore references
    const db = firebase.firestore();
    const chatRef = db.collection('chats').doc(userId).collection('messages');
    const userStatusRef = db.collection('users').doc(userId);
    const adminStatusRef = db.collection('admin').doc('status');
    
    // First check if the chat has been deleted by admin
    userStatusRef.get().then(doc => {
        if (doc.exists && doc.data().chatDeleted) {
            // Chat was deleted by admin, clear local storage
            clearChatHistory();
            
            // Reset the deleted flag (so we don't keep showing the message)
            userStatusRef.update({
                chatDeleted: false
            }).catch(err => console.error("Error resetting chat deleted flag:", err));
            
            // Clear messages content and show deletion message
            messagesContent.innerHTML = '';
            showChatDeletedMessage(messagesContent);
            
            // Scroll to bottom after showing deletion message
            setTimeout(() => scrollToBottom(messagesContent), 100);
        }
        
        // Continue with normal initialization
        continueInitialization();
    }).catch(error => {
        console.error("Error checking chat deleted status:", error);
        continueInitialization();
    });
    
    function continueInitialization() {
        // Clear existing messages first
        messagesContent.innerHTML = '';
        
        // Update user status to show online
        updateUserStatus(userStatusRef, true);
        
        // Setup admin status listener
        setupAdminStatusListener(adminStatusRef);
        
        // Setup chat message listener
        const unsubscribe = setupChatListener(chatRef, messagesContent);
        
        // Setup send button click handler
        setupMessageSending(messageInput, sendButton, chatRef, userId);
        
        // Handle cleanup when user leaves
        window.addEventListener('beforeunload', () => {
            updateUserStatus(userStatusRef, false);
            unsubscribe();
        });
        
        // Mark as initialized to prevent multiple instances
        window.chatInitialized = true;
        window.chatUnsubscribe = unsubscribe;
        
        // Add a scroll to bottom after a delay to handle page refresh
        setTimeout(() => {
            scrollToBottom(messagesContent);
            // Double-check scroll position after a longer delay
            setTimeout(() => {
                if (messagesContent.scrollHeight - messagesContent.scrollTop > 100) {
                    scrollToBottom(messagesContent);
                }
            }, 500);
        }, 100);
    }
}

// Function to clear chat history from local storage
function clearChatHistory() {
    const userId = getChatUserId();
    localStorage.removeItem(`chat_history_${userId}`);
    console.log("Chat history cleared due to admin deletion");
}

// Show message that chat was deleted by admin
function showChatDeletedMessage(messagesContent) {
    const deletedMessage = document.createElement('div');
    deletedMessage.className = 'message message-received system-message';
    deletedMessage.textContent = 'This conversation has been deleted by the admin. Any new messages will start a new conversation.';
    deletedMessage.style.backgroundColor = '#f8d7da';
    deletedMessage.style.color = '#721c24';
    deletedMessage.style.padding = '12px';
    deletedMessage.style.margin = '20px auto';
    deletedMessage.style.textAlign = 'center';
    deletedMessage.style.maxWidth = '90%';
    
    messagesContent.appendChild(deletedMessage);
    
    // Show welcome message after deletion notice
    showWelcomeMessage(messagesContent);
}

// Show welcome message in the chat
function showWelcomeMessage(messagesContent) {
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'message message-received welcome-message';
    welcomeMessage.textContent = 'Welcome! This is a private chat. You can expect a response within 24 hours. Please leave your name along with your message.';
    messagesContent.appendChild(welcomeMessage);
}

// Show error message in the chat
function showChatError(errorMessage) {
    const messagesContent = document.querySelector('.messages-content');
    if (!messagesContent) return;
    
    const errorElement = document.createElement('div');
    errorElement.className = 'chat-error-message';
    errorElement.innerHTML = `
        <div style="padding: 15px; background-color: #ffcccc; border-radius: 8px; margin: 10px 0; text-align: center;">
            <p style="margin: 0; color: #cc0000; font-weight: bold;">Error</p>
            <p style="margin: 5px 0; font-size: 14px;">${errorMessage}</p>
        </div>
    `;
    messagesContent.appendChild(errorElement);
}

// Update user online status
function updateUserStatus(userStatusRef, isOnline) {
    const currentUser = (window.firebase && firebase.auth) ? firebase.auth().currentUser : null;
    const displayName = getChatDisplayName();
    
    userStatusRef.set({
        online: isOnline,
        lastActive: firebase.firestore.FieldValue.serverTimestamp(),
        userId: getChatUserId(),
        displayName: currentUser ? currentUser.displayName : null,
        email: currentUser ? currentUser.email : null,
        sessionName: displayName, // This is what the admin will see as the session identifier
        isAuthenticated: !!currentUser
    }, { merge: true });
}

// Setup admin status listener
function setupAdminStatusListener(adminStatusRef) {
    const statusIndicator = document.querySelector('.admin-status');
    if (!statusIndicator) return;
    
    // Create status text element if it doesn't exist
    if (!statusIndicator.querySelector('.status-text')) {
        const statusText = document.createElement('div');
        statusText.className = 'status-text';
        statusText.textContent = 'Last seen: Just now';
        statusIndicator.appendChild(statusText);
    }
    
    adminStatusRef.onSnapshot(snapshot => {
        const adminStatus = snapshot.exists ? snapshot.data() : { online: false, lastActive: null };
        const statusText = statusIndicator.querySelector('.status-text');
        
        if (adminStatus.online) {
            statusText.classList.add('online');
            statusText.textContent = 'Active now';
        } else {
            statusText.classList.remove('online');
            
            if (adminStatus.lastActive) {
                const lastActive = adminStatus.lastActive.toDate ? 
                    adminStatus.lastActive.toDate() : 
                    new Date(adminStatus.lastActive);
                
                const now = new Date();
                const diff = now - lastActive;
                
                // Format the time difference
                let timeString;
                if (diff < 60000) { // Less than 1 minute
                    timeString = 'Just now';
                } else if (diff < 3600000) { // Less than 1 hour
                    const minutes = Math.floor(diff / 60000);
                    timeString = `${minutes}m ago`;
                } else if (diff < 86400000) { // Less than 1 day
                    const hours = Math.floor(diff / 3600000);
                    timeString = `${hours}h ago`;
                } else {
                    timeString = lastActive.toLocaleDateString() + ' ' + lastActive.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                }
                
                statusText.textContent = `Last seen: ${timeString}`;
            } else {
                statusText.textContent = 'Last seen: Never';
            }
        }
    }, error => {
        console.error("Error monitoring admin status:", error);
    });
}

// Setup chat message listener
function setupChatListener(chatRef, messagesContent) {
    // Track seen messages to prevent duplicates
    const seenMessageIds = new Set();
    
    // Clear any existing messages first to prevent duplicates
    messagesContent.innerHTML = '';
    
    // Show welcome message
    showWelcomeMessage(messagesContent);
    
    // Also listen for deletion events on the user document
    const userId = getChatUserId();
    const userStatusRef = firebase.firestore().collection('users').doc(userId);
    const userStatusUnsubscribe = userStatusRef.onSnapshot(doc => {
        if (doc.exists && doc.data().chatDeleted) {
            // Chat was deleted by admin while user was active
            clearChatHistory();
            
            // Reset the deleted flag
            userStatusRef.update({
                chatDeleted: false
            }).catch(err => console.error("Error resetting chat deleted flag:", err));
            
            // Show deletion message
            messagesContent.innerHTML = '';
            showChatDeletedMessage(messagesContent);
        }
    }, error => {
        console.error("Error listening for chat deletion:", error);
    });
    
    // Mark previous messages as delivered
    chatRef.where('sender', '==', 'user')
        .where('delivered', '==', false)
        .get()
        .then(snapshot => {
            const batch = firebase.firestore().batch();
            snapshot.forEach(doc => {
                batch.update(doc.ref, { delivered: true });
            });
            return batch.commit();
        })
        .catch(error => {
            console.error("Error marking messages as delivered:", error);
        });
    
    // Listen for new messages
    const messagesUnsubscribe = chatRef.orderBy('timestamp', 'asc').onSnapshot(snapshot => {
        // Check if this is the initial load (no messages displayed yet)
        const isInitialLoad = messagesContent.children.length <= 1; // Only welcome message
        
        // Process all messages to ensure proper ordering
        const allMessages = [];
        let userMessages = [];
        
        snapshot.forEach(doc => {
            const messageData = doc.data();
            const messageId = doc.id;
            
            if (messageData && messageData.timestamp) {
                allMessages.push({
                    id: messageId,
                    data: messageData
                });
                
                // Track user messages for status updates
                if (messageData.sender === 'user') {
                    const timestamp = messageData.timestamp ? 
                        (messageData.timestamp.toDate ? messageData.timestamp.toDate().getTime() : new Date(messageData.timestamp).getTime()) 
                        : Date.now();
                    
                    userMessages.push({
                        id: messageId,
                        data: messageData,
                        timestamp: timestamp
                    });
                }
            }
        });
        
        // Clear and re-render all messages
        messagesContent.innerHTML = '';
        showWelcomeMessage(messagesContent);
        
        // Display all messages
        allMessages.forEach(message => {
            const messageId = message.id;
            const messageData = message.data;
            
            // Mark admin messages as seen if not already
            if (messageData.sender === 'admin' && !messageData.seen && !seenMessageIds.has(messageId)) {
                chatRef.doc(messageId).update({ 
                    seen: true,
                    seenAt: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(error => console.error("Error marking message as seen:", error));
                
                // Show notification for new admin messages
                console.log('New admin message received:', messageData);
                const messageText = messageData.text || 
                    (messageData.imageUrl ? '📷 Image' : 
                    (messageData.fileUrl ? '📎 File attachment' : 'New message'));
                
                showIOSNotification(messageText);
            }
            
            // Mark user messages as delivered if not already
            if (messageData.sender === 'user' && !messageData.delivered) {
                chatRef.doc(messageId).update({ delivered: true })
                    .catch(error => console.error("Error marking message as delivered:", error));
            }
            
            // Add to seen set
            seenMessageIds.add(messageId);
            
            // Display the message
            displayMessage(messagesContent, messageData, messageId, false);
        });
        
        // Sort user messages by timestamp
        userMessages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Find latest read message
        let latestReadMessage = null;
        for (let i = userMessages.length - 1; i >= 0; i--) {
            if (userMessages[i].data.seen) {
                latestReadMessage = userMessages[i];
                break;
            }
        }
        
        // Find latest delivered message (if no read message)
        let latestDeliveredMessage = null;
        if (!latestReadMessage) {
            for (let i = userMessages.length - 1; i >= 0; i--) {
                if (userMessages[i].data.delivered) {
                    latestDeliveredMessage = userMessages[i];
                    break;
                }
            }
        }
        
        // Update status displays
        updateMessageStatuses(messagesContent, latestReadMessage, latestDeliveredMessage);
        
        // Scroll to bottom after rendering
        setTimeout(() => scrollToBottom(messagesContent), 100);
    }, error => {
        console.error("Error loading messages:", error);
        showChatError("Failed to load messages. Please try again later.");
    });
    
    // Return a combined unsubscribe function
    return function() {
        userStatusUnsubscribe();
        messagesUnsubscribe();
    };
}

// Update status displays for all messages
function updateMessageStatuses(messagesContent, latestReadMessage, latestDeliveredMessage) {
    // First remove all existing status indicators
    const existingStatuses = messagesContent.querySelectorAll('.message-status');
    existingStatuses.forEach(status => {
        status.remove();
    });
    
    // Add status to latest read message if exists
    if (latestReadMessage) {
        const msgElement = messagesContent.querySelector(`[data-message-id="${latestReadMessage.id}"]`);
        if (msgElement) {
            const container = msgElement.closest('.message-container');
            if (container) {
                const statusElement = document.createElement('div');
                statusElement.className = 'message-status';
                
                const readTime = latestReadMessage.data.seenAt ? 
                    new Date(latestReadMessage.data.seenAt.toDate ? 
                        latestReadMessage.data.seenAt.toDate() : 
                        latestReadMessage.data.seenAt) : 
                    new Date();
                
                const formattedTime = readTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                statusElement.textContent = `Read ${formattedTime}`;
                
                container.appendChild(statusElement);
            }
        }
    }
    // If no read message, add status to latest delivered message
    else if (latestDeliveredMessage) {
        const msgElement = messagesContent.querySelector(`[data-message-id="${latestDeliveredMessage.id}"]`);
        if (msgElement) {
            const container = msgElement.closest('.message-container');
            if (container) {
                const statusElement = document.createElement('div');
                statusElement.className = 'message-status';
                statusElement.textContent = 'Delivered';
                container.appendChild(statusElement);
            }
        }
    }
}

// Function to extract YouTube video ID from URL
function extractYouTubeVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
}

// Function to detect YouTube URLs in text
function detectYouTubeUrls(text) {
    const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/g;
    const urls = [];
    let match;
    
    while ((match = youtubeRegex.exec(text)) !== null) {
        const fullUrl = match[0];
        const videoId = extractYouTubeVideoId(fullUrl);
        if (videoId) {
            urls.push({
                url: fullUrl,
                videoId: videoId,
                thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
            });
        }
    }
    
    return urls;
}

// Display a message in the chat
function displayMessage(messagesContent, messageData, messageId, showStatus = false) {
    // Skip if missing required data
    if (!messageData) return;
    
    // Debug log to check message data
    console.log('Displaying message:', { messageData, messageId, sender: messageData.sender });
    
    // Get formatted timestamp for the message
    const timestamp = messageData.timestamp ? 
        (messageData.timestamp.toDate ? messageData.timestamp.toDate() : new Date(messageData.timestamp)) : 
        new Date();
    const formattedTime = timestamp.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    
    // For user messages, create a container
    if (messageData.sender === 'user') {
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = 'message message-sent';
        messageElement.dataset.messageId = messageId;
        
        // Handle image messages
        if (messageData.imageUrl) {
            messageElement.className += ' image-message';
            const image = document.createElement('img');
            image.src = messageData.imageUrl;
            image.alt = 'Shared image';
            image.style.maxWidth = '100%';
            image.style.borderRadius = '12px';
            messageElement.appendChild(image);
        } else if (messageData.fileData && messageData.isInlineFile) {
            if (messageData.fileType.startsWith('image/')) {
                // It's a base64 encoded image
                messageElement.className += ' image-message';
                const image = document.createElement('img');
                image.src = messageData.fileData;
                image.alt = 'Shared image';
                image.style.maxWidth = '100%';
                image.style.borderRadius = '12px';
                messageElement.appendChild(image);
            } else if (messageData.fileType.startsWith('video/')) {
                // It's a video file - display inline
                messageElement.className += ' video-message';
                const video = document.createElement('video');
                video.src = messageData.fileData;
                video.controls = true;
                video.preload = 'metadata';
                video.style.maxWidth = '100%';
                video.style.maxHeight = '300px';
                video.style.borderRadius = '12px';
                video.style.backgroundColor = '#000';
                messageElement.appendChild(video);
            } else {
                // It's a document (PDF, Word, etc.)
                messageElement.className += ' document-message';
                
                // Create document container
                const docContainer = document.createElement('div');
                docContainer.className = 'document-container';
                docContainer.style.backgroundColor = '#007AFF';
                docContainer.style.padding = (messageData.fileType === 'application/pdf' || 
                                           messageData.fileType.includes('word') || 
                                           messageData.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') 
                                           ? '8px' : '15px';
                docContainer.style.borderRadius = '18px';
                docContainer.style.color = 'white';
                docContainer.style.display = 'flex';
                docContainer.style.flexDirection = 'column';
                docContainer.style.gap = '10px';
                docContainer.style.alignItems = 'center';
                docContainer.style.cursor = 'pointer'; // Add pointer cursor to indicate it's clickable
                
                // Add document icon and name
                const docInfo = document.createElement('div');
                docInfo.className = 'document-info';
                docInfo.style.display = 'flex';
                docInfo.style.alignItems = 'center';
                docInfo.style.gap = '8px';
                
                const icon = document.createElement('i');
                if (messageData.fileType === 'application/pdf') {
                    icon.className = 'fas fa-file-pdf';
                } else {
                    icon.className = 'fas fa-file-word';
                }
                icon.style.fontSize = '24px';
                
                const fileName = document.createElement('span');
                fileName.className = 'document-name';
                fileName.textContent = messageData.fileName || 'Document';
                fileName.style.wordBreak = 'break-word';
                fileName.style.maxWidth = '200px';
                
                docInfo.appendChild(icon);
                docInfo.appendChild(fileName);
                
                // Create a function for preview but without showing buttons
                const showPreview = async () => {
                    // Create modal popup for document preview
                    const previewModal = document.createElement('div');
                    previewModal.className = 'document-preview-modal';
                    previewModal.style.position = 'fixed';
                    previewModal.style.top = '0';
                    previewModal.style.left = '0';
                    previewModal.style.width = '100%';
                    previewModal.style.height = '100%';
                    previewModal.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
                    previewModal.style.zIndex = '10000';
                    previewModal.style.display = 'flex';
                    previewModal.style.justifyContent = 'center';
                    previewModal.style.alignItems = 'center';
                    
                    const modalContent = document.createElement('div');
                    modalContent.className = 'modal-content';
                    modalContent.style.backgroundColor = '#fff';
                    modalContent.style.width = '90%';
                    modalContent.style.maxWidth = '800px';
                    modalContent.style.maxHeight = '80%';
                    modalContent.style.borderRadius = '12px';
                    modalContent.style.overflow = 'hidden';
                    modalContent.style.display = 'flex';
                    modalContent.style.flexDirection = 'column';
                    
                    const modalHeader = document.createElement('div');
                    modalHeader.className = 'modal-header';
                    modalHeader.style.display = 'flex';
                    modalHeader.style.justifyContent = 'space-between';
                    modalHeader.style.alignItems = 'center';
                    modalHeader.style.padding = '15px';
                    modalHeader.style.borderBottom = '1px solid #eee';
                    
                    const modalTitle = document.createElement('h3');
                    modalTitle.textContent = messageData.fileName || 'Document Preview';
                    modalTitle.style.margin = '0';
                    modalTitle.style.fontSize = '16px';
                    modalTitle.style.fontWeight = '600';
                    
                    const closeButton = document.createElement('button');
                    closeButton.innerHTML = '<i class="fas fa-times"></i>';
                    closeButton.style.background = 'none';
                    closeButton.style.border = 'none';
                    closeButton.style.fontSize = '18px';
                    closeButton.style.cursor = 'pointer';
                    closeButton.style.padding = '5px';
                    closeButton.setAttribute('aria-label', 'Close preview');
                    
                    modalHeader.appendChild(modalTitle);
                    modalHeader.appendChild(closeButton);
                    
                    const modalBody = document.createElement('div');
                    modalBody.className = 'modal-body';
                    modalBody.style.padding = '20px';
                    modalBody.style.overflow = 'auto';
                    modalBody.style.flex = '1';
                    modalBody.style.maxHeight = 'calc(80vh - 70px)';
                    
                    // Loading indicator
                    const loadingElement = document.createElement('div');
                    loadingElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading document...';
                    loadingElement.style.textAlign = 'center';
                    loadingElement.style.padding = '20px';
                    modalBody.appendChild(loadingElement);
                    
                    modalContent.appendChild(modalHeader);
                    modalContent.appendChild(modalBody);
                    previewModal.appendChild(modalContent);
                    document.body.appendChild(previewModal);
                    
                    // Close modal when clicking the close button
                    closeButton.addEventListener('click', () => {
                        document.body.removeChild(previewModal);
                    });
                    
                    // Close modal when clicking outside the content
                    previewModal.addEventListener('click', (event) => {
                        if (event.target === previewModal) {
                            document.body.removeChild(previewModal);
                        }
                    });
                    
                    // Process Word documents
                    if (messageData.fileType === 'application/msword' || 
                        messageData.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                        
                        try {
                            // Convert base64 data to array buffer
                            const base64Data = messageData.fileData.split(',')[1];
                            const binaryString = window.atob(base64Data);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            const arrayBuffer = bytes.buffer;
                            
                            // Use mammoth.js to convert Word to HTML
                            const result = await mammoth.convertToHtml({ arrayBuffer });
                            
                            // Replace loading indicator with content
                            modalBody.innerHTML = '';
                            
                            // Add styles
                            const styleElement = document.createElement('style');
                            styleElement.textContent = `
                                .document-content { color: #000000; font-weight: 500; }
                                .document-content p { margin: 0 0 8px 0; color: #000000; }
                                .document-content h1 { font-size: 22px; margin: 20px 0 10px 0; color: #000000; }
                                .document-content h2 { font-size: 18px; margin: 15px 0 8px 0; color: #000000; }
                                .document-content ul, .document-content ol { margin: 8px 0; padding-left: 25px; color: #000000; }
                                .document-content table { border-collapse: collapse; margin: 10px 0; }
                                .document-content td, .document-content th { border: 1px solid #ddd; padding: 6px; color: #000000; }
                            `;
                            modalBody.appendChild(styleElement);
                            
                            // Add content
                            const contentElement = document.createElement('div');
                            contentElement.className = 'document-content';
                            contentElement.innerHTML = result.value;
                            modalBody.appendChild(contentElement);
                        } catch (error) {
                            console.error('Error previewing document:', error);
                            modalBody.innerHTML = `
                                <div style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 4px;">
                                    <p>Unable to preview document.</p>
                                </div>
                            `;
                        }
                    } else if (messageData.fileType === 'application/pdf') {
                        // For PDF files
                        try {
                            const base64Data = messageData.fileData;
                            const pdfEmbed = document.createElement('embed');
                            pdfEmbed.src = base64Data;
                            pdfEmbed.type = 'application/pdf';
                            pdfEmbed.style.width = '100%';
                            pdfEmbed.style.height = '70vh';
                            
                            modalBody.innerHTML = '';
                            modalBody.appendChild(pdfEmbed);
                        } catch (error) {
                            modalBody.innerHTML = `
                                <div style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 4px;">
                                    <p>Error previewing PDF document.</p>
                                </div>
                            `;
                            console.error('Error previewing PDF:', error);
                        }
                    }
                };
                
                // Add click event to docContainer to show preview
                docContainer.addEventListener('click', showPreview);
                
                docContainer.appendChild(docInfo);
                messageElement.appendChild(docContainer);
            }
        } else if (messageData.fileUrl) {
            messageElement.className += ' document-message';
            
            // Create document container for admin messages (gray instead of blue)
            const docContainer = document.createElement('div');
            docContainer.className = 'document-container';
            docContainer.style.backgroundColor = '#E9E9EB';
            docContainer.style.padding = '15px';
            docContainer.style.borderRadius = '18px';
            docContainer.style.color = '#000';
            docContainer.style.display = 'flex';
            docContainer.style.flexDirection = 'column';
            docContainer.style.gap = '10px';
            docContainer.style.alignItems = 'center';
            
            // Add document info
            const docInfo = document.createElement('div');
            docInfo.className = 'document-info';
            docInfo.style.display = 'flex';
            docInfo.style.alignItems = 'center';
            docInfo.style.gap = '8px';
            
            const icon = document.createElement('i');
            if (messageData.fileType === 'application/pdf') {
                icon.className = 'fas fa-file-pdf';
            } else {
                icon.className = 'fas fa-file-word';
            }
            icon.style.fontSize = '24px';
            icon.style.color = '#007AFF';
            
            const fileName = document.createElement('span');
            fileName.className = 'document-name';
            fileName.textContent = messageData.fileName || 'Document';
            fileName.style.wordBreak = 'break-word';
            fileName.style.maxWidth = '200px';
            
            docInfo.appendChild(icon);
            docInfo.appendChild(fileName);
            
                // Add download link
                const downloadLink = document.createElement('a');
                downloadLink.href = messageData.fileUrl;
                downloadLink.className = 'document-download';
                downloadLink.download = messageData.fileName || 'document';
                downloadLink.innerHTML = '<i class="fas fa-download"></i> Download';
                downloadLink.style.color = '#007AFF';
                downloadLink.style.textDecoration = 'none';
                downloadLink.style.display = 'flex';
                downloadLink.style.alignItems = 'center';
                downloadLink.style.gap = '5px';
            
            docContainer.appendChild(docInfo);
            docContainer.appendChild(downloadLink);
            messageElement.appendChild(docContainer);
        } else {
            messageElement.textContent = messageData.text;
        }
        
        // Create message actions container
        const messageActions = document.createElement('div');
        messageActions.className = 'message-actions';
        
        // Add edit button for text messages only
        if (!messageData.imageUrl && !messageData.fileUrl && !messageData.fileData) {
            const editButton = document.createElement('button');
            editButton.className = 'message-action-btn edit-message-btn';
            editButton.innerHTML = '<i class="fas fa-edit"></i>';
            editButton.title = 'Edit message';
            editButton.addEventListener('click', () => {
                // Get only the message text, excluding the timestamp
                const messageText = messageElement.childNodes[0] ? messageElement.childNodes[0].textContent : '';
                const input = document.createElement('input');
                input.type = 'text';
                input.value = messageText;
                input.className = 'message-edit-input';
                input.style.width = '100%';
                input.style.padding = '5px';
                input.style.borderRadius = '4px';
                input.style.border = '1px solid #007aff';
                
                // Replace text with input
                messageElement.innerHTML = '';
                messageElement.appendChild(input);
                input.focus();
                
                // Handle edit completion
                const handleEdit = async () => {
                    const newText = input.value.trim();
                    if (newText && newText !== messageText) {
                        try {
                            // Get the chat reference
                            const userId = getChatUserId();
                            const chatRef = firebase.firestore()
                                .collection('chats')
                                .doc(userId)
                                .collection('messages')
                                .doc(messageId);
                            
                            // Update in Firestore
                            await chatRef.update({
                                text: newText,
                                edited: true,
                                editedAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            
                            // Update in DOM
                            messageElement.innerHTML = newText;
                            
                            // Re-add the message actions and timestamp
                            const messageActions = document.createElement('div');
                            messageActions.className = 'message-actions';
                            messageActions.appendChild(editButton);
                            messageActions.appendChild(deleteButton);
                            messageElement.appendChild(messageActions);
                            
                            const timeElement = document.createElement('div');
                            timeElement.className = 'message-time-hidden';
                            timeElement.textContent = formattedTime;
                            messageElement.appendChild(timeElement);
                        } catch (error) {
                            console.error('Error editing message:', error);
                            alert('Failed to edit message. Please try again.');
                        }
                    } else {
                        // If no changes or empty, revert to original text
                        messageElement.innerHTML = messageText;
                        
                        // Re-add the message actions and timestamp
                        const messageActions = document.createElement('div');
                        messageActions.className = 'message-actions';
                        messageActions.appendChild(editButton);
                        messageActions.appendChild(deleteButton);
                        messageElement.appendChild(messageActions);
                        
                        const timeElement = document.createElement('div');
                        timeElement.className = 'message-time-hidden';
                        timeElement.textContent = formattedTime;
                        messageElement.appendChild(timeElement);
                    }
                    
                    // Remove event listeners
                    input.removeEventListener('blur', handleEdit);
                    input.removeEventListener('keydown', handleKeyDown);
                };
                
                // Handle Enter key
                const handleKeyDown = (e) => {
                    if (e.key === 'Enter') {
                        input.blur();
                    }
                };
                
                input.addEventListener('blur', handleEdit);
                input.addEventListener('keydown', handleKeyDown);
            });
            messageActions.appendChild(editButton);
        }
        
        // Add delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'message-action-btn delete-message-btn';
        deleteButton.innerHTML = '<i class="fas fa-times"></i>';
        deleteButton.title = 'Delete message';
        deleteButton.addEventListener('click', async () => {
            try {
                // Get the chat reference
                const userId = getChatUserId();
                const chatRef = firebase.firestore()
                    .collection('chats')
                    .doc(userId)
                    .collection('messages')
                    .doc(messageId);
                
                // Delete from Firestore
                await chatRef.delete();
                
                // No need to delete from storage for base64 files as they're stored in Firestore
                
                // Remove the message container from DOM
                messageContainer.remove();
            } catch (error) {
                console.error('Error deleting message:', error);
                alert('Failed to delete message. Please try again.');
            }
        });
        messageActions.appendChild(deleteButton);
        
        // Add message actions to message element
        messageElement.appendChild(messageActions);
        
        // Add hidden timestamp that appears on hover
        const timeElement = document.createElement('div');
        timeElement.className = 'message-time-hidden';
        timeElement.textContent = formattedTime;
        messageElement.appendChild(timeElement);
        
        // Add message to container
        messageContainer.appendChild(messageElement);
        
        // Add status element if needed (will be updated later)
        if (showStatus) {
            const statusElement = document.createElement('div');
            statusElement.className = 'message-status';
            
            if (messageData.seen) {
                const readTime = messageData.seenAt ? 
                    new Date(messageData.seenAt.toDate ? messageData.seenAt.toDate() : messageData.seenAt) : 
                    new Date();
                const readFormattedTime = readTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                statusElement.textContent = `Read ${readFormattedTime}`;
            } else if (messageData.delivered) {
                statusElement.textContent = 'Delivered';
            } else {
                statusElement.textContent = 'Sent';
            }
            
            messageContainer.appendChild(statusElement);
        }
        
        // Add container to chat
        messagesContent.appendChild(messageContainer);
    } else {
        // For received messages from admin
        const messageElement = document.createElement('div');
        messageElement.className = 'message message-received';
        messageElement.dataset.messageId = messageId;
        
        // Handle different message types from admin
        if (messageData.imageUrl) {
            messageElement.className += ' image-message';
            const image = document.createElement('img');
            image.src = messageData.imageUrl;
            image.alt = 'Shared image';
            image.style.maxWidth = '100%';
            image.style.borderRadius = '12px';
            messageElement.appendChild(image);
        } else if (messageData.fileData && messageData.isInlineFile) {
            // Handle base64 files from admin
            if (messageData.fileType.startsWith('image/')) {
                messageElement.className += ' image-message';
                const image = document.createElement('img');
                image.src = messageData.fileData;
                image.alt = 'Shared image';
                image.style.maxWidth = '100%';
                image.style.borderRadius = '12px';
                messageElement.appendChild(image);
            } else if (messageData.fileType.startsWith('video/')) {
                // It's a video file - display inline
                messageElement.className += ' video-message';
                const video = document.createElement('video');
                video.src = messageData.fileData;
                video.controls = true;
                video.preload = 'metadata';
                video.style.maxWidth = '100%';
                video.style.maxHeight = '300px';
                video.style.borderRadius = '12px';
                video.style.backgroundColor = '#000';
                messageElement.appendChild(video);
            } else {
                messageElement.className += ' document-message';
                
                // Create document container with gray background for admin messages
                const docContainer = document.createElement('div');
                docContainer.className = 'document-container';
                docContainer.style.backgroundColor = '#E9E9EB';
                docContainer.style.padding = '15px';
                docContainer.style.borderRadius = '18px';
                docContainer.style.color = '#000';
                docContainer.style.display = 'flex';
                docContainer.style.flexDirection = 'column';
                docContainer.style.gap = '10px';
                docContainer.style.alignItems = 'center';
                docContainer.style.cursor = 'pointer'; // Add pointer cursor to indicate it's clickable
                
                // Add document info
                const docInfo = document.createElement('div');
                docInfo.className = 'document-info';
                docInfo.style.display = 'flex';
                docInfo.style.alignItems = 'center';
                docInfo.style.gap = '8px';
                
                const icon = document.createElement('i');
                if (messageData.fileType === 'application/pdf') {
                    icon.className = 'fas fa-file-pdf';
                } else {
                    icon.className = 'fas fa-file-word';
                }
                icon.style.fontSize = '24px';
                icon.style.color = '#007AFF';
                
                const fileName = document.createElement('span');
                fileName.className = 'document-name';
                fileName.textContent = messageData.fileName || 'Document';
                fileName.style.wordBreak = 'break-word';
                fileName.style.maxWidth = '200px';
                
                docInfo.appendChild(icon);
                docInfo.appendChild(fileName);

                // Make the container clickable for preview
                docContainer.style.cursor = 'pointer';
                docContainer.addEventListener('click', () => {
                    // Create preview modal
                    const modal = document.createElement('div');
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.width = '100%';
                    modal.style.height = '100%';
                    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
                    modal.style.display = 'flex';
                    modal.style.justifyContent = 'center';
                    modal.style.alignItems = 'center';
                    modal.style.zIndex = '10000';
                    
                    const modalContent = document.createElement('div');
                    modalContent.style.backgroundColor = '#fff';
                    modalContent.style.width = '90%';
                    modalContent.style.maxWidth = '800px';
                    modalContent.style.maxHeight = '90vh';
                    modalContent.style.borderRadius = '12px';
                    modalContent.style.overflow = 'hidden';
                    modalContent.style.position = 'relative';
                    
                    const closeBtn = document.createElement('button');
                    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
                    closeBtn.style.position = 'absolute';
                    closeBtn.style.top = '15px';
                    closeBtn.style.right = '15px';
                    closeBtn.style.background = 'none';
                    closeBtn.style.border = 'none';
                    closeBtn.style.fontSize = '24px';
                    closeBtn.style.cursor = 'pointer';
                    closeBtn.style.zIndex = '1';
                    closeBtn.style.color = '#000';
                    
                    const iframe = document.createElement('iframe');
                    iframe.style.width = '100%';
                    iframe.style.height = '90vh';
                    iframe.style.border = 'none';
                    
                    // Use Google Docs Viewer for documents
                    if (messageData.fileType?.includes('word') || 
                        messageData.fileName?.toLowerCase().endsWith('.doc') || 
                        messageData.fileName?.toLowerCase().endsWith('.docx')) {
                        iframe.src = `https://docs.google.com/viewer?url=${encodeURIComponent(messageData.fileUrl)}&embedded=true`;
                    } else {
                        iframe.src = messageData.fileUrl;
                    }
                    
                    modalContent.appendChild(closeBtn);
                    modalContent.appendChild(iframe);
                    modal.appendChild(modalContent);
                    document.body.appendChild(modal);
                    
                    // Close modal when clicking close button or outside
                    const closeModal = () => document.body.removeChild(modal);
                    closeBtn.onclick = closeModal;
                    modal.onclick = (e) => {
                        if (e.target === modal) closeModal();
                    };
                });
                
                docContainer.appendChild(docInfo);
                messageElement.appendChild(docContainer);
            }
        } else if (messageData.fileUrl) {
            messageElement.className += ' document-message';
            
            // Create document container for admin messages (gray instead of blue)
            const docContainer = document.createElement('div');
            docContainer.className = 'document-container';
            docContainer.style.backgroundColor = '#E9E9EB';
            docContainer.style.padding = '15px';
            docContainer.style.borderRadius = '18px';
            docContainer.style.color = '#000';
            docContainer.style.display = 'flex';
            docContainer.style.flexDirection = 'column';
            docContainer.style.gap = '10px';
            docContainer.style.alignItems = 'center';
            
            // Add document info
            const docInfo = document.createElement('div');
            docInfo.className = 'document-info';
            docInfo.style.display = 'flex';
            docInfo.style.alignItems = 'center';
            docInfo.style.gap = '8px';
            
            const icon = document.createElement('i');
            if (messageData.fileType === 'application/pdf') {
                icon.className = 'fas fa-file-pdf';
            } else {
                icon.className = 'fas fa-file-word';
            }
            icon.style.fontSize = '24px';
            icon.style.color = '#007AFF';
            
            const fileName = document.createElement('span');
            fileName.className = 'document-name';
            fileName.textContent = messageData.fileName || 'Document';
            fileName.style.wordBreak = 'break-word';
            fileName.style.maxWidth = '200px';
            
            docInfo.appendChild(icon);
            docInfo.appendChild(fileName);
            
            // Add download link
            const downloadLink = document.createElement('a');
            downloadLink.href = messageData.fileUrl;
            downloadLink.className = 'document-download';
            downloadLink.download = messageData.fileName || 'document';
            downloadLink.innerHTML = '<i class="fas fa-download"></i> Download';
            downloadLink.style.color = '#007AFF';
            downloadLink.style.textDecoration = 'none';
            downloadLink.style.display = 'flex';
            downloadLink.style.alignItems = 'center';
            downloadLink.style.gap = '5px';
            
            docContainer.appendChild(docInfo);
            docContainer.appendChild(downloadLink);
            messageElement.appendChild(docContainer);
        } else {
            messageElement.textContent = messageData.text;
        }
        
        // Add hidden timestamp that appears on hover
        const timeElement = document.createElement('div');
        timeElement.className = 'message-time-hidden';
        timeElement.textContent = formattedTime;
        messageElement.appendChild(timeElement);
        
        // Add to chat
        messagesContent.appendChild(messageElement);
    }
}

// Setup message sending
function setupMessageSending(messageInput, sendButton, chatRef, userId) {
    // Function to send a message
    const sendMessage = async () => {
        const text = messageInput.value.trim();
        // >>> ADDED: SignOut command support <<<
        if (text.toLowerCase() === 'signout') {
            // Clear the text field
            messageInput.value = '';

            // Unsubscribe any active chat listeners
            if (window.chatUnsubscribe) {
                try { window.chatUnsubscribe(); } catch (e) { console.error(e); }
            }
            window.chatInitialized = false;

            // Perform Firebase sign-out if a user is currently signed in
            if (window.firebase && firebase.auth && firebase.auth().currentUser) {
                try { await firebase.auth().signOut(); } catch (err) { console.error('Sign-out error:', err); }
            }

            // Show Google sign-in prompt again
            const messagesAppElem = document.getElementById('messages-app');
            if (messagesAppElem) {
                showGoogleSignInPrompt(messagesAppElem, initializeChat);
            }
            return; // Do not send the SignOut text as a normal message
        }
        const imagePreview = document.querySelector('.image-preview');
        
        if (!text && !imagePreview) return;
        
        // Check all rate limits before proceeding
        const limits = [
            { type: 'messages', error: 'You have sent too many messages. Please wait before sending more.' },
            { type: 'totalMessages', error: 'You have reached your daily message limit.' }
        ];
        
        for (const limit of limits) {
            if (!window.RateLimiter.canPerformAction(limit.type)) {
                window.RateLimiter.showRateLimitError(limit.type, limit.error);
                return;
            }
        }
        
        // Additional check if we have reached absolute Firebase limits
        const messageCount = window.RateLimiter.getCurrentUsage('totalMessages');
        const storageUsed = window.RateLimiter.getCurrentUsage('totalStorage');
        
        if (messageCount >= 200) {
            alert('Daily message limit reached (200 messages). This limit helps prevent Firebase quota exhaustion. Please try again tomorrow.');
            return;
        }
        
        if (storageUsed >= 20 * 1024 * 1024) {
            alert('Daily storage limit reached (20MB). This limit helps prevent Firebase quota exhaustion. Please try again tomorrow.');
            return;
        }
        
        // Clear input immediately
        messageInput.value = '';
        
        // Create a temporary message container with loading state
        const tempContainer = document.createElement('div');
        tempContainer.className = 'message-container temp-message';
        
        const tempMessage = document.createElement('div');
        tempMessage.className = 'message message-sent';
        
        // Handle image if present
        if (imagePreview) {
            tempMessage.className += ' image-message';
            const img = imagePreview.querySelector('img');
            const image = document.createElement('img');
            image.src = img.src;
            image.alt = 'Shared image';
            tempMessage.appendChild(image);
            
            // Remove the preview
            imagePreview.remove();
        } else {
            tempMessage.textContent = text;
        }
        
        const tempStatus = document.createElement('div');
        tempStatus.className = 'message-status';
        tempStatus.textContent = 'Sending...';
        
        tempContainer.appendChild(tempMessage);
        tempContainer.appendChild(tempStatus);
        
        // Add to chat container
        const messagesContent = document.querySelector('.messages-content');
        if (messagesContent) {
            messagesContent.appendChild(tempContainer);
            scrollToBottom(messagesContent);
        }
        
        try {
            // Generate a client-side ID for this message
            const clientMessageId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            
            // Prepare message data
            const messageData = {
                sender: 'user',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                clientMessageId: clientMessageId,
                delivered: true,
                seen: false,
                senderDisplayName: firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.displayName : null,
                senderEmail: firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.email : null,
                senderSessionName: getChatDisplayName() // For admin preview
            };
            
            // If there's an image, upload it first
            if (imagePreview) {
                const img = imagePreview.querySelector('img');
                const response = await fetch(img.src);
                const blob = await response.blob();
                
                // Generate a unique filename
                const timestamp = Date.now();
                const uniqueFilename = `chat_images/${getChatUserId()}/${timestamp}_image.jpg`;
                
                // Upload image to Firebase Storage
                const storageRef = firebase.storage().ref(uniqueFilename);
                const uploadTask = await storageRef.put(blob);
                
                // Get the download URL
                const downloadURL = await uploadTask.ref.getDownloadURL();
                
                // Add image URL to message data
                messageData.imageUrl = downloadURL;
            } else {
                messageData.text = text;
            }
            
            // Add message to Firestore
            const docRef = await chatRef.add(messageData);

            // Mark as delivered for the sender
            await docRef.update({ delivered: true });
            
            // Record rate limit usage
            window.RateLimiter.recordAction('messages');
            window.RateLimiter.recordAction('totalMessages');
            
            // Remove temporary message (the real message will be added by the listener)
            if (tempContainer && tempContainer.parentNode) {
                tempContainer.parentNode.removeChild(tempContainer);
            }
            
            // Remove has-content class if no text
            const messagesInputField = document.querySelector('.messages-input-field');
            if (messagesInputField && !messageInput.value.trim()) {
                messagesInputField.classList.remove('has-content');
            }
        } catch (error) {
            console.error("Error sending message:", error);
            // Show error in the temp message
            if (tempStatus) {
                tempStatus.textContent = 'Failed to send';
                tempStatus.style.color = '#ff3b30';
            }
        }
    };
    
    // Send on button click
    sendButton.addEventListener('click', sendMessage);
    
    // Send on Enter key
    messageInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Add attachment button functionality
    const attachmentBtn = document.querySelector('.attachment-btn');
    if (attachmentBtn) {
        attachmentBtn.addEventListener('click', handleAttachmentClick);
    }
}

// Scroll to the bottom of the chat
function scrollToBottom(messagesContent) {
    // Force a reflow to ensure all content is rendered
    messagesContent.offsetHeight;
    
    // Scroll to the maximum possible scroll position
    messagesContent.scrollTop = messagesContent.scrollHeight;
    
    // Double-check scroll position after a short delay
    setTimeout(() => {
        messagesContent.scrollTop = messagesContent.scrollHeight;
        
        // If still not at bottom, try one more time with a longer delay
        if (messagesContent.scrollHeight - messagesContent.scrollTop > 100) {
            setTimeout(() => {
                messagesContent.scrollTop = messagesContent.scrollHeight;
            }, 500);
        }
    }, 100);
}

// Function to handle attachment button click
function handleAttachmentClick() {
    // Create a hidden file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,video/*,.doc,.docx,.pdf';
    fileInput.style.display = 'none';
    
    // Add the file input to the document
    document.body.appendChild(fileInput);
    
    // Trigger the file input click
    fileInput.click();
    
    // Handle file selection
    fileInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Get the messages content area
            const messagesContent = document.querySelector('.messages-content');
            if (!messagesContent) return;
            
            // Check file size - limit to 15MB to accommodate video files
            if (file.size > 15 * 1024 * 1024) {
                alert('File is too large. Please choose a file under 15MB.');
                document.body.removeChild(fileInput);
                return;
            }
            
            // Check storage rate limit
            if (!window.RateLimiter.canPerformAction('totalStorage', file.size)) {
                const currentUsage = window.RateLimiter.getCurrentUsage('totalStorage');
                const remaining = window.RateLimiter.getRemainingAllowance('totalStorage');
                const currentMB = (currentUsage / (1024 * 1024)).toFixed(1);
                const remainingMB = (remaining / (1024 * 1024)).toFixed(1);
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
                
                alert(`Storage limit exceeded!\n\nFile size: ${fileSizeMB}MB\nUsed today: ${currentMB}MB\nRemaining: ${remainingMB}MB\n\nYour daily limit is 20MB. This resets every 24 hours.`);
                document.body.removeChild(fileInput);
                return;
            }
            
            // Create a temporary message container with loading state
            const tempContainer = document.createElement('div');
            tempContainer.className = 'message-container temp-message';
            
            const tempMessage = document.createElement('div');
            tempMessage.className = 'message message-sent';
            
            // Check file type
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const isDocument = file.type === 'application/pdf' || 
                             file.type === 'application/msword' || 
                             file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            
            // Create appropriate preview based on file type
            if (isImage) {
                tempMessage.className += ' image-message';
                tempMessage.innerHTML = `
                    <div style="padding: 20px; text-align: center;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #007AFF;"></i>
                        <div style="margin-top: 10px;">Processing image...</div>
                    </div>
                `;
            } else if (isVideo) {
                tempMessage.className += ' video-message';
                tempMessage.innerHTML = `
                    <div style="padding: 20px; text-align: center;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #007AFF;"></i>
                        <div style="margin-top: 10px;">Processing video...</div>
                        <div style="margin-top: 5px; font-size: 12px; opacity: 0.7;">${file.name}</div>
                    </div>
                `;
            } else if (isDocument) {
                tempMessage.className += ' document-message';
                tempMessage.innerHTML = `
                    <div class="document-container" style="background-color: #007AFF; padding: 15px; border-radius: 18px; color: white;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="${file.type === 'application/pdf' ? 'fas fa-file-pdf' : 'fas fa-file-word'}" style="font-size: 24px;"></i>
                            <span style="word-break: break-word; max-width: 200px;">${file.name}</span>
                        </div>
                        <div style="margin-top: 10px; display: flex; align-items: center; gap: 5px;">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Processing...</span>
                        </div>
                        <div style="margin-top: 5px; font-size: 11px; opacity: 0.8;">
                            <i class="fas fa-eye"></i> Preview will be available after upload
                        </div>
                    </div>
                `;
            }
            
            const tempStatus = document.createElement('div');
            tempStatus.className = 'message-status';
            tempStatus.textContent = 'Processing...';
            
            tempContainer.appendChild(tempMessage);
            tempContainer.appendChild(tempStatus);
            
            // Add to chat container and scroll
            messagesContent.appendChild(tempContainer);
            scrollToBottom(messagesContent);
            
            // For all files, use direct base64 encoding instead of Firebase Storage
            // Read the file as data URL (base64)
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    // Get base64 data
                    const base64Data = event.target.result;
                    console.log("File processed as base64");
                    
                    // Check file size - Firestore has a 1MB limit per document
                    const base64Size = base64Data.length;
                    const estimatedMB = (base64Size * 0.75) / (1024 * 1024); // Base64 is ~33% larger
                    
                    console.log(`File size check:`, {
                        fileName: file.name,
                        fileType: file.type,
                        originalSizeMB: (file.size / (1024 * 1024)).toFixed(2),
                        base64Length: base64Size,
                        estimatedSizeMB: estimatedMB.toFixed(2),
                        isWordDoc: file.type.includes('word') || file.type.includes('officedocument')
                    });
                    
                    // Add message to Firestore
                    const chatRef = firebase.firestore()
                        .collection('chats')
                        .doc(getChatUserId())
                        .collection('messages');
                    
                    // If file is too large for Firestore (approaching 1MB limit), use Firebase Storage instead
                    if (base64Size > 900000) { // ~675KB actual size, leaving some buffer
                        console.log("File too large for inline storage, using Firebase Storage instead");
                        
                        tempStatus.textContent = 'Uploading large file...';
                        
                        // Upload to Firebase Storage
                        const timestamp = Date.now();
                        const uniqueFilename = `chat_files/${getChatUserId()}/${timestamp}_${file.name}`;
                        const storageRef = firebase.storage().ref(uniqueFilename);
                        const uploadTask = await storageRef.put(file);
                        const downloadURL = await uploadTask.ref.getDownloadURL();
                        
                        // Save reference in Firestore
                        const messageData = {
                            sender: 'user',
                            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                            delivered: true,
                            seen: false,
                            fileName: file.name,
                            fileType: file.type,
                            fileUrl: downloadURL,
                            fileSize: file.size,
                            senderDisplayName: firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.displayName : null,
                            senderEmail: firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.email : null,
                            senderSessionName: getChatDisplayName() // For admin preview
                        };
                        
                        console.log("Saving file reference to Firestore");
                        await chatRef.add(messageData);
                        console.log("File reference saved");
                        
                        // Record rate limit usage
                        window.RateLimiter.recordAction('attachments');
                        window.RateLimiter.recordAction('totalStorage', { size: file.size });
                        
                        // Update storage usage bar
                        if (window.updateStorageUsageBar) {
                            window.updateStorageUsageBar();
                        }
                    } else {
                        // Small file, store inline as before
                        const messageData = {
                            sender: 'user',
                            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                            delivered: true,
                            seen: false,
                            fileName: file.name,
                            fileType: file.type,
                            fileData: base64Data,
                            isInlineFile: true,
                            senderDisplayName: firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.displayName : null,
                            senderEmail: firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.email : null,
                            senderSessionName: getChatDisplayName() // For admin preview
                        };
                        
                        console.log("Saving message to Firestore");
                        await chatRef.add(messageData);
                        console.log("Message saved");
                        
                        // Record rate limit usage
                        window.RateLimiter.recordAction('attachments');
                        window.RateLimiter.recordAction('totalStorage', { size: file.size });
                        
                        // Update storage usage bar
                        if (window.updateStorageUsageBar) {
                            window.updateStorageUsageBar();
                        }
                    }
                    
                    // Remove temporary message
                    if (tempContainer && tempContainer.parentNode) {
                        tempContainer.parentNode.removeChild(tempContainer);
                    }
                } catch (error) {
                    console.error("Error saving message:", error);
                    tempStatus.innerHTML = '';
                    
                    const errorText = document.createElement('span');
                    errorText.textContent = 'Failed to send';
                    errorText.style.color = '#ff3b30';
                    tempStatus.appendChild(errorText);
                    
                    // Show retry button
                    const retryBtn = document.createElement('button');
                    retryBtn.textContent = 'Retry';
                    retryBtn.style.marginLeft = '10px';
                    retryBtn.style.padding = '3px 8px';
                    retryBtn.style.backgroundColor = '#007AFF';
                    retryBtn.style.color = 'white';
                    retryBtn.style.border = 'none';
                    retryBtn.style.borderRadius = '4px';
                    retryBtn.style.cursor = 'pointer';
                    retryBtn.style.fontSize = '12px';
                    retryBtn.addEventListener('click', () => {
                        if (tempContainer && tempContainer.parentNode) {
                            tempContainer.parentNode.removeChild(tempContainer);
                        }
                        handleAttachmentClick();
                    });
                    tempStatus.appendChild(retryBtn);
                    
                    // Update error state
                    const uploadingText = tempMessage.querySelector('span:last-child');
                    if (uploadingText) {
                        uploadingText.textContent = 'Failed to send';
                        uploadingText.style.color = '#ff3b30';
                    }
                    const spinner = tempMessage.querySelector('.fa-spinner');
                    if (spinner) {
                        spinner.className = 'fas fa-exclamation-circle';
                        spinner.style.color = '#ff3b30';
                    }
                }
            };
            
            reader.onerror = (error) => {
                console.error("Error reading file:", error);
                tempStatus.innerHTML = '';
                
                const errorText = document.createElement('span');
                errorText.textContent = 'Failed to read file';
                errorText.style.color = '#ff3b30';
                tempStatus.appendChild(errorText);
                
                // Show retry button
                const retryBtn = document.createElement('button');
                retryBtn.textContent = 'Retry';
                retryBtn.style.marginLeft = '10px';
                retryBtn.style.padding = '3px 8px';
                retryBtn.style.backgroundColor = '#007AFF';
                retryBtn.style.color = 'white';
                retryBtn.style.border = 'none';
                retryBtn.style.borderRadius = '4px';
                retryBtn.style.cursor = 'pointer';
                retryBtn.style.fontSize = '12px';
                retryBtn.addEventListener('click', () => {
                    if (tempContainer && tempContainer.parentNode) {
                        tempContainer.parentNode.removeChild(tempContainer);
                    }
                    handleAttachmentClick();
                });
                tempStatus.appendChild(retryBtn);
            };
            
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Error handling attachment:", error);
            alert('Failed to process file. Please try again.');
        }
        
        // Remove the file input from the document
        document.body.removeChild(fileInput);
    });
}

async function handleSendMessage() {
    const input = document.querySelector('.messages-input');
    const message = input.value.trim();
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    
    if (!message && !file) return;
    
    try {
        const chatRef = db.collection('chats').doc(getChatUserId());
        const messageData = {
            sender: 'user',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (file) {
            const storageRef = firebase.storage().ref();
            const fileRef = storageRef.child(`chat_files/${getChatUserId()}/${file.name}`);
            await fileRef.put(file);
            const fileUrl = await fileRef.getDownloadURL();
            
            messageData.fileUrl = fileUrl;
            messageData.fileName = file.name;
            messageData.fileType = file.type;
        } else {
            messageData.text = message;
        }
        
        await chatRef.add(messageData);
        input.value = '';
        fileInput.value = '';
        
        // Clear any previews
        const imagePreview = document.querySelector('.image-preview');
        if (imagePreview) {
            imagePreview.remove();
        }
        
        const documentPreview = document.querySelector('.document-preview');
        if (documentPreview) {
            documentPreview.remove();
        }
        
        // Hide send button
        const sendBtn = document.querySelector('.messages-send-btn');
        if (sendBtn) {
            sendBtn.style.display = 'none';
        }
        
        // Remove has-content class
        const inputField = document.querySelector('.messages-input-field');
        inputField.classList.remove('has-content');
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
} 

// ... existing code ...
// Typewriter animation for background text (two lines, two spans)
(function typewriterEffect() {
    // Check if mobile device - skip typewriter animations on mobile
    if (window.innerWidth <= 768) {
        return; // Exit early on mobile devices
    }
    
    const line1 = 'Trush Patel';
    const line2 = 'Software Engineer';
    const line3 = 'Download Resume';
    const el1 = document.getElementById('typewriter-line1');
    const el2 = document.getElementById('typewriter-line2');
    const el3 = document.getElementById('typewriter-line3');
    let char1 = 0, char2 = 0, char3 = 0;
    const delay = 80;

    // Hide the second and third lines initially
    if (el2) el2.style.visibility = 'hidden';
    if (el3) el3.style.visibility = 'hidden';
    if (el1) el1.style.width = '0px';
    if (el2) el2.style.width = '0px';
    if (el3) el3.style.width = '0px';

    function typeLine1() {
        if (char1 < line1.length) {
            el1.textContent += line1[char1++];
            // Expand width to fit content
            el1.style.width = el1.scrollWidth + 'px';
            setTimeout(typeLine1, delay);
        } else {
            setTimeout(() => {
                if (el2) el2.style.visibility = 'visible';
                typeLine2();
            }, 400);
        }
    }
    function typeLine2() {
        if (char2 < line2.length) {
            el2.textContent += line2[char2++];
            // Expand width to fit content
            el2.style.width = el2.scrollWidth + 'px';
            setTimeout(typeLine2, delay);
        } else {
            setTimeout(() => {
                if (el3) el3.style.visibility = 'visible';
                typeLine3();
            }, 400);
        }
    }
    function typeLine3() {
        if (char3 < line3.length) {
            el3.textContent += line3[char3++];
            // Expand width to fit content
            el3.style.width = el3.scrollWidth + 'px';
            setTimeout(typeLine3, delay);
        } else {
            // Enable hover functionality for download options after typing is complete
            const downloadOptionsContainer = document.getElementById('download-options');
            if (downloadOptionsContainer) {
                downloadOptionsContainer.classList.add('typing-complete');
            }

            // Add click functionality for Download Resume
            el3.addEventListener('click', () => {
                // Create a temporary link element to download the resume
                const link = document.createElement('a');
                link.href = 'documents/TrushPatel_Resume.pdf';
                link.download = 'TrushPatel_Resume.pdf';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });

            // Add click functionality for download options
            const downloadOptions = document.querySelectorAll('.download-option');
            downloadOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering the main button
                    const format = option.getAttribute('data-format');
                    const link = document.createElement('a');
                    
                    if (format === 'pdf') {
                        link.href = 'documents/TrushPatel_Resume.pdf';
                        link.download = 'TrushPatel_Resume.pdf';
                    } else if (format === 'word') {
                        link.href = 'documents/TrushPatel_Resume.docx';
                        link.download = 'TrushPatel_Resume.docx';
                    }
                    
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                });
            });

            // Left-side typewriter is complete, now start the right-side typewriter
            setTimeout(() => {
                startRightTypewriter();
            }, 600); // Small delay before starting right-side
        }
    }
    if (el1 && el2 && el3) typeLine1();
})();

// Typewriter animation for right-side text (three lines, clickable)
function startRightTypewriter() {
    // Check if mobile device - skip typewriter animations on mobile
    if (window.innerWidth <= 768) {
        return; // Exit early on mobile devices
    }
    
    const line1 = 'GitHub';
    const line2 = 'LinkedIn';
    const line3 = 'Contact me';
    const el1 = document.getElementById('typewriter-line-right1');
    const el2 = document.getElementById('typewriter-line-right2');
    const el3 = document.getElementById('typewriter-line-right3');
    let char1 = 0, char2 = 0, char3 = 0;
    const delay = 80;

    // Ensure all elements exist before starting
    if (!el1 || !el2 || !el3) return;

    // Make the first element visible and initialize
    el1.style.visibility = 'visible';
    el2.style.visibility = 'hidden';
    el3.style.visibility = 'hidden';
    el1.style.width = '0px';
    el2.style.width = '0px';
    el3.style.width = '0px';

    function typeLine1() {
        if (char1 < line1.length) {
            el1.textContent += line1[char1++];
            el1.style.width = el1.scrollWidth + 'px';
            setTimeout(typeLine1, delay);
        } else {
            // Add click functionality for GitHub
            el1.addEventListener('click', () => {
                window.open('https://github.com/trushpatel97', '_blank');
            });
            setTimeout(() => {
                if (el2) {
                    el2.style.visibility = 'visible';
                    typeLine2();
                }
            }, 400);
        }
    }
    
    function typeLine2() {
        if (char2 < line2.length) {
            el2.textContent += line2[char2++];
            el2.style.width = el2.scrollWidth + 'px';
            setTimeout(typeLine2, delay);
        } else {
            // Add click functionality for LinkedIn
            el2.addEventListener('click', () => {
                window.open('https://www.linkedin.com/in/trush-patel-163813128/', '_blank');
            });
            setTimeout(() => {
                if (el3) {
                    el3.style.visibility = 'visible';
                    typeLine3();
                }
            }, 400);
        }
    }
    
    function typeLine3() {
        if (char3 < line3.length) {
            el3.textContent += line3[char3++];
            el3.style.width = el3.scrollWidth + 'px';
            setTimeout(typeLine3, delay);
        } else {
            // Add click functionality for Contact me
            el3.addEventListener('click', () => {
                // Open messages app (same as clicking messages app from phone)
                const messagesApp = document.getElementById('messages-app');
                if (messagesApp) {
                    // Add active class to show app screen
                    messagesApp.classList.add('active');
                    // Update status bar to black for apps
                    const statusBar = document.querySelector('.status-bar');
                    statusBar.classList.add('in-app');
                    statusBar.classList.remove('light-mode');
                    
                    // Update content display
                    updateContentDisplay('messages');
                }
            });
            
            // Start bottom right typewriter after completion
            setTimeout(() => {
                startBottomRightTypewriter();
            }, 400);
        }
    }
    
    typeLine1();
}

// Typewriter animation for bottom-right text (Book Interview)
function startBottomRightTypewriter() {
    // Check if mobile device - skip typewriter animations on mobile
    if (window.innerWidth <= 768) {
        return; // Exit early on mobile devices
    }
    
    const line = '';
    const el = document.getElementById('typewriter-line-bottom-right');
    const qrContainer = document.getElementById('qr-code-container');
    const qrImage = document.getElementById('qr-code-image');
    let char = 0;
    const delay = 80;

    // Ensure element exists before starting
    if (!el) return;

    // Make the element visible and initialize
    el.style.visibility = 'visible';
    el.style.width = '0px';

    function typeLine() {
        if (char < line.length) {
            el.textContent += line[char++];
            el.style.width = el.scrollWidth + 'px';
            setTimeout(typeLine, delay);
        } else {
            // Add click functionality for Book Interview
            el.addEventListener('click', () => {
                window.open('https://calendly.com/trushp097/30min', '_blank');
            });
            
            // Show QR code after typing completes
            setTimeout(() => {
                if (qrContainer) {
                    qrContainer.classList.add('visible');
                    
                    // Make QR code clickable
                    if (qrImage) {
                        qrImage.style.cursor = 'pointer';
                        qrImage.addEventListener('click', () => {
                            window.open('https://calendly.com/trushp097/30min', '_blank');
                        });
                        
                        // Add hover effect to QR code
                        qrImage.addEventListener('mouseenter', () => {
                            qrImage.style.transform = 'scale(1.05)';
                            qrImage.style.transition = 'transform 0.2s ease';
                        });
                        
                        qrImage.addEventListener('mouseleave', () => {
                            qrImage.style.transform = 'scale(1)';
                        });
                    }
                }
            }, 200);
        }
    }
    
    typeLine();
}
// ... existing code ...

document.addEventListener('DOMContentLoaded', function() {
    // Lofi Music Player Button Logic with floating volume slider and playlist navigation
    (function() {
        const toggleWrapper = document.getElementById('lofi-toggle-wrapper');
        const toggleBtn = document.getElementById('lofi-toggle');
        const icon = document.getElementById('icon-volume');
        const sliderPanel = document.getElementById('lofi-volume-slider');
        const slider = document.getElementById('lofi-slider');
        const audio = document.getElementById('lofi-audio');
        const skipBtn = document.getElementById('lofi-skip');
        const backBtn = document.getElementById('lofi-back');
        const songTitle = document.getElementById('lofi-song-title');
        let hideTimeout = null;

        // Playlist definition
        const playlist = [
            { title: 'Kingdom by the Sea - Mrmcchickino', start: 25, end: 102 }, // 1:42 (skipping first 25 seconds)
            { title: 'Stargaze Walk With Me - Growhead', start: 102, end: 199 }, // 3:19
            { title: 'Departure (ft. Snug) - Peak Twilight', start: 199, end: 288 }, // 4:48
            { title: 'Mirage - Sebastian Kamae & Sleepermane', start: 288, end: 423 }, // 7:03
            { title: 'Miles Away - Fnonose', start: 423, end: 543 }, // 9:03
            { title: 'Goodnight & Sweetdreams - Boone', start: 543, end: 672 }, // 11:12
            { title: 'Tales Of Ibon Ulan (Ame No UTA) - Ihatemago', start: 672, end: 801 }, // 13:21
            { title: 'Belong - Zadbeatz, Tosama Beats', start: 801, end: 911 }, // 15:11
            { title: 'Gentle Soul - Kaspa. x Softy', start: 911, end: 1055 }, // 17:35
            { title: 'Seaside - reidenshi, a/wshhine', start: 1055, end: 9999 } // End
        ];
        let currentSong = 0;

        function setSong(index, play = true) {
            currentSong = Math.max(0, Math.min(index, playlist.length - 1));
            audio.currentTime = playlist[currentSong].start;
            if (play) audio.play();
            updateSongTitle();
        }

        function updateSongTitle() {
            if (songTitle) {
                const marquee = songTitle.querySelector('.marquee');
                const marqueeTexts = songTitle.querySelectorAll('.marquee-text');
                if (marquee && marqueeTexts.length === 2) {
                    marqueeTexts[0].textContent = playlist[currentSong].title;
                    marqueeTexts[1].textContent = playlist[currentSong].title;
                    // Wait for DOM update
                    setTimeout(() => {
                        const parentWidth = songTitle.offsetWidth;
                        const textWidth = marqueeTexts[0].scrollWidth;
                        if (textWidth > parentWidth) {
                            const duration = Math.max(6, (textWidth / 30) * 2); // 15px/sec, min 6s
                            marquee.style.animationDuration = duration + 's';
                            marquee.style.animationPlayState = 'running';
                        } else {
                            marquee.style.animationPlayState = 'paused';
                            marquee.style.transform = 'translateX(0)';
                        }
                    }, 10);
                }
            }
        }

        // Skip to next song
        if (skipBtn) {
            skipBtn.addEventListener('click', function(e) {
                setSong((currentSong + 1) % playlist.length);
            });
        }
        // Go to previous song (or restart current if >2s in)
        if (backBtn) {
            backBtn.addEventListener('click', function(e) {
                if (audio.currentTime - playlist[currentSong].start > 2) {
                    setSong(currentSong, true);
                } else {
                    setSong((currentSong - 1 + playlist.length) % playlist.length);
                }
            });
        }
        // Auto-advance to next song
        audio.addEventListener('timeupdate', function() {
            if (audio.currentTime >= playlist[currentSong].end) {
                if (currentSong < playlist.length - 1) {
                    setSong(currentSong + 1);
                } else {
                    audio.pause();
                }
            }
        });
        // If user seeks, update currentSong
        audio.addEventListener('seeked', function() {
            for (let i = 0; i < playlist.length; i++) {
                if (audio.currentTime >= playlist[i].start && audio.currentTime < playlist[i].end) {
                    currentSong = i;
                    updateSongTitle();
                    break;
                }
            }
        });

        // On load, set initial song title
        updateSongTitle();

        // Set initial audio position to skip first 25 seconds of Kingdom by the Sea
        if (audio) {
            audio.currentTime = playlist[currentSong].start; // Start at 25 seconds for the first song
        }

        // ... existing lofi logic ...
        // Helper: update icon based on volume/mute
        function updateIcon() {
            if (audio.muted || audio.volume === 0) {
                // Muted icon (volume off with slash)
                icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#fff" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.74 2.5-2.26 2.5-4.02z"/><path d="M3 10v4h4l5 5V5l-5 5H3z"/><line x1="21" y1="3" x2="3" y2="21" stroke="#fff" stroke-width="2"/></svg>';
            } else {
                // Regular volume icon
                icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#fff" viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5l-5 5H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.74 2.5-2.26 2.5-4.02z"/></svg>';
            }
        }

        // Show slider on click or hover
        function showSlider() {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            sliderPanel.style.opacity = '1';
            sliderPanel.style.pointerEvents = 'auto';
            sliderPanel.style.display = 'block';
        }
        // Hide slider with fade after 1s
        function hideSlider() {
            if (hideTimeout) clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                sliderPanel.style.opacity = '0';
                sliderPanel.style.pointerEvents = 'none';
                setTimeout(() => {
                    sliderPanel.style.display = 'none';
                }, 300); // match CSS transition
            }, 1000);
        }

        // Toggle mute/unmute on icon click
        icon.parentElement.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent play/pause toggle
            audio.muted = !audio.muted;
            updateIcon();
        });

        // Toggle play/pause on button click, show slider
        toggleBtn.addEventListener('click', function(e) {
            // Only play/pause, do not toggle mute here
            audio.volume = parseFloat(slider.value);
            if (audio.paused) {
                audio.play();
            } else {
                audio.pause();
            }
            updateIcon();
            showSlider();
        });

        // Show slider on hover
        toggleWrapper.addEventListener('mouseenter', showSlider);
        // Hide slider when mouse leaves the wrapper (button + slider)
        toggleWrapper.addEventListener('mouseleave', hideSlider);

        // Adjust volume live
        slider.addEventListener('input', function() {
            audio.volume = parseFloat(slider.value);
            audio.muted = audio.volume === 0;
            updateIcon();
            if (audio.paused && audio.volume > 0) {
                audio.play();
            }
        });

        // Update icon on play/pause/mute/volume
        audio.addEventListener('play', updateIcon);
        audio.addEventListener('pause', updateIcon);
        audio.addEventListener('volumechange', updateIcon);
        audio.addEventListener('ended', updateIcon);

        // Set initial icon and slider
        slider.value = audio.volume;
        updateIcon();
    })();
});
// ... existing code ...

/* ======================= GOOGLE SIGN-IN PROMPT ======================= */
function showGoogleSignInPrompt(messagesApp, onSuccess) {
    // Clear any existing messages content first
    const messagesContent = messagesApp.querySelector('.messages-content');
    if (messagesContent) {
        messagesContent.innerHTML = '';
    }
    
    // Ensure Firebase is initialised for auth
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
        const firebaseConfig = config.firebase;
        firebase.initializeApp(firebaseConfig);
    }

    // Already authenticated? nothing to do
    if (firebase.auth().currentUser) {
        if (onSuccess) onSuccess();
        return;
    }

    // Remove any existing overlays
    const existingOverlays = messagesApp.querySelectorAll('.google-signin-overlay');
    existingOverlays.forEach(overlay => overlay.remove());

    const overlay = document.createElement('div');
    overlay.className = 'google-signin-overlay';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 5000;
        backdrop-filter: blur(1px);
        -webkit-backdrop-filter: blur(1px);
    `;

    const signInContainer = document.createElement('div');
    signInContainer.style.cssText = `
        text-align: center;
        padding: 25px 20px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        max-width: 90%;
        width: 300px;
        margin: 20px;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Sign in Required';
    title.style.cssText = `
        margin: 0 0 8px 0;
        color: #333;
        font-size: 20px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        white-space: nowrap;
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Sign in with Google to start chatting';
    subtitle.style.cssText = `
        margin: 0 0 20px 0;
        color: #666;
        font-size: 14px;
        line-height: 1.3;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const btn = document.createElement('button');
                    btn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 20 20" style="margin-right: 8px; flex-shrink: 0;">
                        <path fill="#4285F4" d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15 1.13-.8 2.2-1.68 2.87v2.34h2.68c1.6-1.47 2.5-3.65 2.5-6.88z"/>
                        <path fill="#34A853" d="M10 20c2.7 0 4.87-.9 6.5-2.39l-2.68-2.34c-.9.6-2.16.96-3.82.96-2.9 0-5.35-1.96-6.25-4.59H.9v2.42C2.6 17.53 6.1 20 10 20z"/>
                        <path fill="#FBBC05" d="M3.75 11.64A5.9 5.9 0 0 1 3.75 8.36V5.94H.9a10.02 10.02 0 0 0 0 8.12l2.85-2.42z"/>
                        <path fill="#EA4335" d="M10 3.98c1.54 0 2.89.53 3.96 1.53L16.62 2.8C14.87 1.19 12.7.2 10 .2 6.1.2 2.6 2.67.9 5.94L3.75 8.36C4.65 5.73 7.1 3.98 10 3.98z"/>
                    </svg>
                    <span style="font-weight: 500; white-space: nowrap; color: #3c4043;">Sign in with Google</span>
                `;
    btn.style.cssText = `
        padding: 12px 16px;
        background: #f8f9fa;
        color: #3c4043;
        border: 1px solid #dadce0;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 1px 3px rgba(60, 64, 67, 0.15);
        white-space: nowrap;
    `;
    
    btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = '#f1f3f4';
        btn.style.boxShadow = '0 2px 8px rgba(60, 64, 67, 0.2)';
    });
    
    btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = '#f8f9fa';
        btn.style.boxShadow = '0 1px 3px rgba(60, 64, 67, 0.15)';
    });

    signInContainer.appendChild(title);
    signInContainer.appendChild(subtitle);
    signInContainer.appendChild(btn);
    overlay.appendChild(signInContainer);
    messagesApp.appendChild(overlay);

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    
    btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px; color: #3c4043;"></i><span style="white-space: nowrap; color: #3c4043;">Signing in...</span>';
        
        firebase.auth().signInWithPopup(provider)
            .then((result) => {
                console.log('Sign-in successful:', result.user.displayName || result.user.email);
                overlay.remove();
                if (onSuccess) onSuccess();
            })
            .catch(err => {
                console.error('Sign-in error:', err);
                btn.disabled = false;
                btn.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 20 20" style="margin-right: 8px; flex-shrink: 0;">
                        <path fill="#4285F4" d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15 1.13-.8 2.2-1.68 2.87v2.34h2.68c1.6-1.47 2.5-3.65 2.5-6.88z"/>
                        <path fill="#34A853" d="M10 20c2.7 0 4.87-.9 6.5-2.39l-2.68-2.34c-.9.6-2.16.96-3.82.96-2.9 0-5.35-1.96-6.25-4.59H.9v2.42C2.6 17.53 6.1 20 10 20z"/>
                        <path fill="#FBBC05" d="M3.75 11.64A5.9 5.9 0 0 1 3.75 8.36V5.94H.9a10.02 10.02 0 0 0 0 8.12l2.85-2.42z"/>
                        <path fill="#EA4335" d="M10 3.98c1.54 0 2.89.53 3.96 1.53L16.62 2.8C14.87 1.19 12.7.2 10 .2 6.1.2 2.6 2.67.9 5.94L3.75 8.36C4.65 5.73 7.1 3.98 10 3.98z"/>
                    </svg>
                    <span style="font-weight: 500; white-space: nowrap;">Sign in with Google</span>
                `;
                alert('Google sign-in failed: ' + (err.message || err));
            });
    });
}
// ... existing code ...

// Export chat as text function
function exportChatAsText() {
    const messagesContent = document.querySelector('.messages-content');
    if (!messagesContent) return;
    
    const messages = messagesContent.querySelectorAll('.message');
    let chatText = 'Chat Export\n';
    chatText += '================\n\n';
    
    messages.forEach(message => {
        const isReceived = message.classList.contains('message-received');
        const isWelcome = message.classList.contains('welcome-message');
        const sender = isReceived ? (isWelcome ? 'System' : 'Trush Patel') : 'You';
        const text = message.textContent || message.innerText;
        chatText += `${sender}: ${text}\n`;
    });
    
    // Create download link
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_export_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// If not yet signed-in (silent login still pending) start chat as soon as auth state becomes ready
if (window.firebase && firebase.auth && !window.chatInitialized) {
    firebase.auth().onAuthStateChanged(user => {
        if (user && !window.chatInitialized) {
            initializeChat();
        }
    });
}

    // ================= Skill Projects Popup =================
    (function initSkillProjectsPopup() {
        const skillMapping = {
            'Python': [
                {
                    id: 'story',
                    title: 'Story Spinner',
                    description: "Web application that generates stories from various categories using NLP",
                    skillUsage: "Summarized generated text and handled backend development using Django",
                    icon: 'images/Story.jpeg'
                },
                {
                    id: 'eye',
                    title: 'Eye Disease Detection',
                    description: 'Classifying the presence of eye diseases in images with Deep Learning',
                    skillUsage: "Utilized Python for model training, validation, testing, and fine-tuning",
                    icon: 'images/Eye.jpeg'
                },
                {
                    id: 'tracking',
                    title: 'Package Tracking System',
                    description: 'AI-driven email responder for package inquiries using OpenAI and historical data',
                    skillUsage: "Automated inquiries using OpenAI API, enforced PEP8 standards with Pylint, and developed APIs using Python",
                    icon: 'images/Package.jpeg'
                },
                {
                    id: 'bigdata',
                    title: 'BigData',
                    description: 'Managing billions of data through GCP',
                    skillUsage: "Retrieved records from BigQuery and Oracle; validated data using Python with visual indicators for mismatches",
                    icon: 'images/GCP.jpg'
                }

            ],
            'JavaScript': [
                {
                    id: 'chalkboard',
                    title: 'Chalkboard',
                    description: 'Web-based collaboration platform that enables users to draw and have video calls simultaneously',
                    skillUsage: "Used JavaScript to change shape/pen colors via the Color Pickr API, enabled Picture-in-Picture (PiP) mode to monitor other tabs/apps while drawing, and implemented a light/dark theme toggle",
                    icon: 'images/ChalkboardLogo.png'
                },
                {
                    id: 'celebrity',
                    title: 'Celebrity Look-alike',
                    description: 'Full stack web app that matches celebrity look-alikes via image URL submissions',
                    skillUsage: "Used JavaScript with React to implement sign-in and registration functionality, tracked user URL submissions to monitor API usage",
                    icon: 'images/Celeb.jpeg'
                },
                {
                    id: 'story',
                    title: 'Story Spinner',
                    description: 'Web application that generates stories from various categories using NLP',
                    skillUsage: "Built frontend interactivity with JavaScript to trigger Django-based Python scripts for automated story generation",
                    icon: 'images/Story.jpeg'
                }
            ],
            'Java': [
                {
                    id: 'vet',
                    title: 'Vet Database',
                    description: 'Java-integrated GUI for managing veterinary records',
                    skillUsage:  "Developed a Java GUI that communicated with an SQL database to add, update, and delete individual records",
                    icon: 'images/vet.png'
                },
                {
                    id: 'colors',
                    title: 'Colors',
                    description: 'Analyze color proportions in a image or video frames',
                    skillUsage: "Used Java with the RXTX library to communicate with Arduino and identify the dominant color; implemented a GUI to visualize color proportions using various graph types",
                    icon: 'images/colors.avif'
                },
            ],
            'C/C++': [
                {
                    id: 'mousetrap',
                    title: 'Mousetrap',
                    description: 'Trapping mice in a box without harming them',
                    skillUsage: "Controlled Arduino to operate a servo and detect mouse movement using sensors",
                    icon: 'images/Mouse.jpeg'
                },
                {
                    id: 'colors',
                    title: 'Colors',
                    description: 'Analyze color proportions in a image or video frames',
                    skillUsage: "Rotated a servo to point toward the dominant color in an image or video frame, based on analysis",
                    icon: 'images/colors.avif'
                }
            ],
            'MATLAB': [
                {
                    id: 'colors',
                    title: 'Colors',
                    description: 'Analyze color proportions in a image or video frames',
                    skillUsage: "MATLAB was used to extract frames from a video and plotting the color proportions of the frames or image",
                    icon: 'images/colors.avif'
                }
            ],
            'HTML/CSS': [
                {
                    id: 'chalkboard',
                    title: 'Chalkboard',
                    description: 'Web-based collaboration platform that enables users to draw and have video calls simultaneously',
                    skillUsage: "Used HTML and CSS to support drawing functionality via the canvas element, including adding images and text. Implemented a theme toggle between light and dark modes using CSS",
                    icon: 'images/ChalkboardLogo.png'
                },
                {
                    id: 'story',
                    title: 'Story Spinner',
                    description: 'Web application that generates stories from various categories using NLP',
                    skillUsage: "Created cards with HTML and styled them using CSS for layout and responsiveness; added interactive backgrounds for enhanced user experience",
                    icon: 'images/Story.jpeg'
                },
                {
                    id: 'celebrity',
                    title: 'Celebrity Look-alike',
                    description: 'Full stack web app that matches celebrity look-alikes via image URL submissions',
                    skillUsage: "Built using React, with HTML (via JSX) to enable URL input, sign-in, and registration features; styled the site using CSS to ensure responsiveness and design",
                    icon: 'images/Celeb.jpeg'
                }
            ],
            'TensorFlow': [
                {
                    id: 'story',
                    title: 'Story Spinner',
                    description: 'Web application that generates stories from various categories using NLP',
                    skillUsage: "TensorFlow (via Keras) is used to load and run pre-trained models for story generation",
                    icon: 'images/Story.jpeg'
                },
                {
                    id: 'eye',
                    title: 'Eye Disease Detection',
                    description: 'Classifying the presence of eye diseases in images with Deep Learning',
                    skillUsage: "Extensively used TensorFlow for model development, training, saving/loading models, and data processing; incorporated Keras layers to enhance classification accuracy",
                    icon: 'images/Eye.jpeg'
                }
            ],
            'NumPy': [
                {
                    id: 'story',
                    title: 'Story Spinner',
                    description: 'platform that enables users to draw and have video calls simultaneously',
                    skillUsage: "NumPy is used for array operations and data manipulation",
                    icon: 'images/Story.jpeg'
                },
                {
                    id: 'eye',
                    title: 'Eye Disease Detection',
                    description: 'Classifying the presence of eye diseases in images with Deep Learning',
                    skillUsage: "NumPy is used for array operations and data manipulation",
                    icon: 'images/Eye.jpeg'
                }
            ],
            'Matplotlib': [
                {
                    id: 'eye',
                    title: 'Eye Disease Detection',
                    description: 'Classifying the presence of eye diseases in images with Deep Learning ',
                    skillUsage: "Displayed model performance using data visualization techniques such as ROC curves",
                    icon: 'images/Eye.jpeg'
                }
            ],
            'Pandas': [
                {
                    id: 'eye',
                    title: 'Eye Disease Detection',
                    description: 'Classifying the presence of eye diseases in images with Deep Learning ',
                    skillUsage: "Grouped data by categories and analyze potential indicators of heart attacks during early-stage research",
                    icon: 'images/Eye.jpeg'
                }
            ],
            'Scikit-learn': [
                {
                    id: 'eye',
                    title: 'Eye Disease Detection',
                    description: 'Classifying the presence of eye diseases in images with Deep Learning ',
                    skillUsage: "Evaluated model performance using accuracy metrics and confusion matrix visualizations",
                    icon: 'images/Eye.jpeg'
                }
            ],
            'OpenAI': [
                {
                    id: 'tracking',
                    title: 'Package Tracking System',
                    description: 'AI-driven email responder for package inquiries using OpenAI and historical data',
                    skillUsage: "GPT-3.5 and GPT-4 to automate email responses; developed prompt logic based on five categories—tracking, shipping, delivery, general, and delays",
                    icon: 'images/Package.jpeg'
                }
            ],
            'SQL': [
                {
                    id: 'vet',
                    title: 'Vet Database',
                    description: 'Java-integrated GUI for managing veterinary records',
                    skillUsage: "Microsoft SQL Server to store vet, owner, pet, and appointment records; implemented one-to-many and one-to-one relationships",
                    icon: 'images/vet.png'
                },
                {
                    id: 'chalkboard',
                    title: 'Chalkboard',
                    description: 'Web-based collaboration platform that enables users to draw and have video calls simultaneously',
                    skillUsage: "SQL is used to store user credentials, Cloud Datastore is used to store user session, and Cloud Storage is used to store images and canvases. This project uses both relational and NoSQL in one project",
                    icon: 'images/ChalkboardLogo.png'
                },
                {
                    id: 'celebrity',
                    title: 'Celebrity Look-alike',
                    description: 'Full stack web app that matches celebrity look-alikes via image URL submissions',
                    skillUsage: "Stored user credentials and tracked API usage per user using PostgreSQL",
                    icon: 'images/Celeb.jpeg'
                }
            ],
            'React': [
                {
                    id: 'celebrity',
                    title: 'Celebrity Look-alike',
                    description: 'Full stack web app that matches celebrity look-alikes via image URL submissions',
                    skillUsage: "Used React for the entire frontend: UI layout, form inputs, routing, authentication, state management, and rendering image recognition results",
                    icon: 'images/Celeb.jpeg'
                }
            ],'Knex.js': [
                {
                    id: 'celebrity',
                    title: 'Celebrity Look-alike',
                    description: 'Full stack web app that matches celebrity look-alikes via image URL submissions',
                    skillUsage: "Knex.js is used to connect to the PostgreSQL database and perform all queries and transactions, including user authentication, registration, and incrementing image submission counts",
                    icon: 'images/Celeb.jpeg'
                }
            ],
            'Django': [
                {
                    id: 'story',
                    title: 'Story Spinner',
                    description: 'Web application that generates stories from various categories using NLP',
                    skillUsage: "Used for the backend to receive user input and call Python NLP models for story generation",
                    icon: 'images/Story.jpeg'
                }
            ]
            // Add more skills and their projects here as needed
        };

        // Inject minimal CSS for the popup
        const skillPopupStyles = document.createElement('style');
        skillPopupStyles.textContent = `
            .skill-popup-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.45);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            .skill-popup {
                background: white;
                border-radius: 14px;
                width: 90%;
                max-width: 400px;
                padding: 20px 18px 24px 18px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                position: relative;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .skill-popup h2 {
                text-align: center;
                font-size: 20px;
                font-weight: 600;
                margin: 0 0 18px 0;
                color: #000;
            }
            .skill-project-card {
                display: flex;
                align-items: center;
                gap: 14px;
                border: 1px solid #e0e0e0;
                border-radius: 12px;
                padding: 12px 14px;
                margin-bottom: 14px;
                cursor: pointer;
                transition: background 0.25s ease, transform 0.1s ease;
            }
            .skill-project-card:active {
                transform: scale(0.98);
            }
            .skill-project-icon {
                width: 46px;
                height: 46px;
                border-radius: 50%;
                background-size: cover;
                background-position: center;
                flex-shrink: 0;
            }
            .skill-project-info {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            .skill-project-title {
                font-size: 15px;
                font-weight: 600;
                color: #333;
                margin-bottom: 4px;
            }
            .skill-project-desc {
                font-size: 12px;
                color: #666;
                line-height: 1.3;
                margin-bottom: 4px;
            }
            .skill-project-usage {
                font-size: 12px;
                color: #666;
                line-height: 1.3;
            }
            .skill-project-usage-label {
                font-weight: 600;
            }
            /* Shift popup slightly left on larger screens */
            @media (min-width: 768px) {
                .skill-popup {
                    margin-left: -40px; /* move ~40px to the left */
                }
            }
            .skill-project-list {
                max-height: 260px; /* ~3 cards visible before scrolling */
                overflow-y: auto;
                padding-right: 4px;
            }
            .skill-project-list::-webkit-scrollbar {
                width: 6px;
            }
            .skill-project-list::-webkit-scrollbar-thumb {
                background-color: rgba(0,0,0,0.2);
                border-radius: 3px;
            }
        `;
        document.head.appendChild(skillPopupStyles);

        // Helper to open project app
        function launchProjectApp(projectId) {
            // Close any open popup first
            const existing = document.querySelector('.skill-popup-overlay');
            if (existing) existing.remove();

            // Open Projects folder then the project screen
            const projectsApp = document.getElementById('projects-app');
            if (projectsApp) projectsApp.classList.add('active');
            if (typeof openProject === 'function') {
                openProject(projectId);
            }
        }

        function createPopup(skillName) {
            const projects = skillMapping[skillName];
            if (!projects || projects.length === 0) return;

            const overlay = document.createElement('div');
            overlay.className = 'skill-popup-overlay';

            const popup = document.createElement('div');
            popup.className = 'skill-popup';

            const closeBtn = document.createElement('div');
            closeBtn.className = 'skill-popup-close';
            closeBtn.onclick = () => overlay.remove();

            const headerWrap = document.createElement('div');
            headerWrap.style.display = 'flex';
            headerWrap.style.alignItems = 'center';
            headerWrap.style.justifyContent = 'center';
            headerWrap.style.position = 'relative';

            const header = document.createElement('h2');
            header.textContent = `${skillName} Projects`;
            header.style.flex = '1';
            header.style.textAlign = 'center';

            headerWrap.appendChild(header);
            headerWrap.appendChild(closeBtn);
            popup.appendChild(headerWrap);

            const list = document.createElement('div');
            list.className = 'skill-project-list';

            projects.forEach(proj => {
                const card = document.createElement('div');
                card.className = 'skill-project-card';
                card.onclick = () => launchProjectApp(proj.id);

                const iconDiv = document.createElement('div');
                iconDiv.className = 'skill-project-icon';
                iconDiv.style.backgroundImage = `url('${proj.icon}')`;

                const infoDiv = document.createElement('div');
                infoDiv.className = 'skill-project-info';

                const titleEl = document.createElement('div');
                titleEl.className = 'skill-project-title';
                titleEl.textContent = proj.title;

                const descEl = document.createElement('div');
                descEl.className = 'skill-project-desc';
                descEl.textContent = proj.description;

                const usageEl = document.createElement('div');
                usageEl.className = 'skill-project-usage';
                usageEl.innerHTML = `<span class="skill-project-usage-label">How it's used:</span> ${proj.skillUsage}`;

                infoDiv.appendChild(titleEl);
                infoDiv.appendChild(descEl);
                infoDiv.appendChild(usageEl);

                card.appendChild(iconDiv);
                card.appendChild(infoDiv);

                list.appendChild(card);
            });

            popup.appendChild(list);

            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            // Close when clicking outside the popup
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.remove();
            });

            // Prevent overlay click when clicking inside the popup
            popup.addEventListener('click', (e) => e.stopPropagation());

            overlay.appendChild(popup);
            document.body.appendChild(overlay);
        }

        // INSERT: mapping from skill names to logo paths
        const skillLogos = {
            'Python': 'skillimages/Python.png',
            'JavaScript': 'skillimages/JavaScript.png',
            'Java': 'skillimages/Java.png',
            'C/C++': 'skillimages/CProgramming.png',
            'MATLAB': 'skillimages/MATLAB.png',
            'HTML/CSS': 'skillimages/HTMLCSS.png',
            'TensorFlow': 'skillimages/Tensorflow.png',
            'NumPy': 'skillimages/NumPy.png',
            'Matplotlib': 'skillimages/Matplotlib.png',
            'Pandas': 'skillimages/Pandas.png',
            'Scikit-learn': 'skillimages/scikit-learn.png',
            'OpenAI': 'skillimages/OpenAi.png',
            'SQL': 'skillimages/SQL.png',
            'React': 'skillimages/React.png',
            'Knex.js': 'skillimages/Knex.js.png',
            'Django': 'skillimages/django.png'
        };

        // ... existing code ...
        // REPLACE the existing skill-item foreach block
        // Attach click listeners to skill items and inject logos

        // ... existing code ...
        document.querySelectorAll('#skills-app .skill-item').forEach(item => {
            const skillName = item.textContent.trim();

            // Add logo to the right if available
            const logoPath = skillLogos[skillName];
            if (logoPath) {
                const img = document.createElement('img');
                img.src = logoPath;
                img.alt = `${skillName} logo`;
                img.className = 'skill-logo';
                item.appendChild(img);
            }

            // Open projects popup on click
            item.addEventListener('click', () => {
                createPopup(skillName);
            });
        });
        // ... existing code ...
    })();
    // ================= End Skill Projects Popup =================

    // ================= Resume Download Popup =================
    function openResumePopup() {
        const popup = document.getElementById('resume-popup-overlay');
        if (popup) {
            popup.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
    }

    function closeResumePopup() {
        const popup = document.getElementById('resume-popup-overlay');
        if (popup) {
            popup.classList.remove('active');
            document.body.style.overflow = ''; // Restore scrolling
        }
    }

    function downloadResume(format) {
        const fileName = format === 'pdf' ? 'TrushPatel_Resume.pdf' : 'TrushPatel_Resume.docx';
        const filePath = `documents/${fileName}`;
        
        // Create a temporary link element
        const link = document.createElement('a');
        link.href = filePath;
        link.download = fileName;
        link.target = '_blank';
        
        // Trigger the download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Close the popup after download
        closeResumePopup();
    }

    // Resume popup event listeners
    document.addEventListener('DOMContentLoaded', function() {
        // Download format buttons
        const formatBtns = document.querySelectorAll('.resume-format-btn');
        formatBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const format = this.getAttribute('data-format');
                downloadResume(format);
            });
        });

        // Close popup when clicking outside
        const popupOverlay = document.getElementById('resume-popup-overlay');
        if (popupOverlay) {
            popupOverlay.addEventListener('click', function(event) {
                // Only close if clicking on the overlay, not the popup content
                if (event.target === popupOverlay) {
                    closeResumePopup();
                }
            });
        }
    });
    // ================= End Resume Download Popup =================