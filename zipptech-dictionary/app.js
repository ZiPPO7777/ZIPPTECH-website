 document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const themeToggle = document.getElementById('themeToggle');
    const searchInput = document.getElementById('searchInput');
    const wordResult = document.getElementById('wordResult');
    const errorMessage = document.getElementById('errorMessage');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const bookmarksList = document.getElementById('bookmarksList');
    const historyList = document.getElementById('historyList');
    const emptyBookmarks = document.getElementById('emptyBookmarks');
    const emptyHistory = document.getElementById('emptyHistory');
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const navItems = document.querySelectorAll('.nav-item');
    const toast = document.getElementById('toast');

    // State with case-insensitive handling
    let currentWord = '';
    let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
    let history = JSON.parse(localStorage.getItem('history')) || [];
    let cachedWords = JSON.parse(localStorage.getItem('cachedWords')) || {};

    // Initialize
    updateBookmarksDisplay();
    updateHistoryDisplay();
    checkThemePreference();

    // Event Listeners
    themeToggle.addEventListener('click', toggleTheme);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchWord();
        }
    });

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.getAttribute('data-tab'));
        });
    });

    // Bottom nav switching
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const tab = this.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    // Functions
    function checkThemePreference() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const savedTheme = localStorage.getItem('theme');
        
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.body.classList.add('dark-mode');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }

    function toggleTheme() {
        document.body.classList.toggle('dark-mode');
        
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            localStorage.setItem('theme', 'light');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }

    function switchTab(tabName) {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        navItems.forEach(item => item.classList.remove('active'));
        
        document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
        document.querySelector(`.nav-item[data-tab="${tabName}"]`).classList.add('active');
    }

    async function searchWord() {
        const word = searchInput.value.trim();
        if (!word) return;

        currentWord = word;
        showLoading();
        hideError();
        
        try {
            // Check cache first (case-insensitive)
            const cachedKey = Object.keys(cachedWords).find(
                key => key.toLowerCase() === word.toLowerCase()
            );
            
            if (cachedKey) {
                displayWord(cachedWords[cachedKey]);
                addToHistory(word);
                hideLoading();
                return;
            }

            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            
            if (!response.ok) {
                throw new Error('Word not found');
            }
            
            const data = await response.json();
            displayWord(data[0]);
            addToHistory(word);
            
            // Cache the word with lowercase key
            cachedWords[word.toLowerCase()] = data[0];
            localStorage.setItem('cachedWords', JSON.stringify(cachedWords));
        } catch (error) {
            showError(error.message);
        } finally {
            hideLoading();
        }
    }

    function displayWord(wordData) {
        if (!wordData) {
            showError('No word data available');
            return;
        }

        const { word, phonetic, phonetics, meanings, sourceUrls } = wordData;
        
        // Find all audio URLs
        const audioUrls = phonetics.filter(p => p.audio).map(p => p.audio);
        
        let html = `
            <div class="word-card">
                <div class="word-header">
                    <div>
                        <h1 class="word-title">${word || 'No word found'}</h1>
                        ${phonetic ? `<div class="word-phonetic">${phonetic}</div>` : ''}
                        ${audioUrls.length > 0 ? `
                            <div class="pronunciation">
                                <span>Pronunciation: </span>
                                ${audioUrls.map((url, index) => `
                                    <button class="audio-btn" onclick="playAudio('${url}')" title="Play pronunciation ${index + 1}">
                                        <i class="fas fa-volume-up"></i>
                                    </button>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="word-actions">
                        <button class="action-btn bookmark-btn ${isBookmarked(word) ? 'bookmarked' : ''}" 
                            onclick="toggleBookmark('${word}')" title="Bookmark">
                            <i class="fas fa-bookmark"></i>
                        </button>
                        <button class="action-btn highlight-btn" onclick="highlightText()" title="Highlight">
                            <i class="fas fa-highlighter"></i>
                        </button>
                        <button class="action-btn copy-btn" onclick="copyDefinition('${word}')" title="Copy">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
        `;

        if (meanings && meanings.length > 0) {
            meanings.forEach(meaning => {
                const { partOfSpeech, definitions, synonyms } = meaning;
                
                html += `
                    <div class="part-of-speech">${partOfSpeech || 'Unknown part of speech'}</div>
                `;
                
                if (definitions && definitions.length > 0) {
                    definitions.slice(0, 5).forEach((def, index) => {
                        html += `
                            <div class="definition">
                                ${def.definition || 'No definition available'}
                                ${def.example ? `<div class="example">"${def.example}"</div>` : ''}
                            </div>
                        `;
                    });
                }
                
                if (synonyms && synonyms.length > 0) {
                    html += `
                        <div class="synonyms-container">
                            <div style="margin-top: 0.5rem; font-weight: 500;">Synonyms:</div>
                            <div class="synonyms">
                                ${synonyms.slice(0, 10).map(syn => `
                                    <span class="synonym" onclick="searchSynonym('${syn}')">${syn}</span>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }
            });
        } else {
            html += `<div class="definition">No meanings found for this word</div>`;
        }

        if (sourceUrls && sourceUrls.length > 0) {
            html += `
                <div style="margin-top: 1rem; font-size: 0.9rem;">
                    Source: <a href="${sourceUrls[0]}" target="_blank" style="color: var(--primary-color);">${sourceUrls[0]}</a>
                </div>
            `;
        }

        html += `</div>`;
        
        wordResult.innerHTML = html;
        
        // Animate the card
        gsap.from(".word-card", {
            opacity: 0,
            y: 50,
            duration: 0.5,
            ease: "back.out(1)"
        });
    }

    function playAudio(url) {
        if (url) {
            try {
                const audio = new Audio(url);
                audio.play().catch(e => {
                    showToast("Audio playback failed");
                    console.error("Audio playback failed:", e);
                });
            } catch (e) {
                showToast("Audio playback error");
                console.error("Audio error:", e);
            }
        }
    }

    function toggleBookmark(word) {
        if (!word) {
            showToast("No word to bookmark");
            return;
        }
        
        // Case-insensitive search
        const index = bookmarks.findIndex(b => 
            b.word && b.word.toLowerCase() === word.toLowerCase()
        );
        
        if (index === -1) {
            // Add bookmark
            bookmarks.unshift({
                word: word, // Store original case
                date: new Date().toISOString()
            });
            
            showToast("Bookmark added");
            
            // Pulse animation for feedback
            const btn = document.querySelector('.bookmark-btn');
            if (btn) {
                gsap.to(btn, {
                    scale: 1.3,
                    duration: 0.2,
                    yoyo: true,
                    repeat: 1
                });
            }
        } else {
            // Remove bookmark
            bookmarks.splice(index, 1);
            showToast("Bookmark removed");
        }
        
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        updateBookmarksDisplay();
        
        // Update bookmark button state
        const bookmarkBtns = document.querySelectorAll('.bookmark-btn');
        bookmarkBtns.forEach(btn => {
            if (btn) {
                btn.classList.toggle('bookmarked', index === -1);
            }
        });
    }

    function isBookmarked(word) {
        if (!word) return false;
        return bookmarks.some(b => 
            b.word && b.word.toLowerCase() === word.toLowerCase()
        );
    }

    function addToHistory(word) {
        if (!word) return;
        
        // Case-insensitive check
        history = history.filter(item => 
            item.word && item.word.toLowerCase() !== word.toLowerCase()
        );
        
        // Add to beginning
        history.unshift({
            word: word, // Store original case
            date: new Date().toISOString()
        });
        
        // Keep only last 50 items
        if (history.length > 50) {
            history.pop();
        }
        
        localStorage.setItem('history', JSON.stringify(history));
        updateHistoryDisplay();
    }

    function updateBookmarksDisplay() {
        if (!bookmarks || bookmarks.length === 0) {
            bookmarksList.style.display = 'none';
            emptyBookmarks.style.display = 'block';
            return;
        }
        
        bookmarksList.style.display = 'block';
        emptyBookmarks.style.display = 'none';
        
        bookmarksList.innerHTML = bookmarks.map(bookmark => `
            <div class="bookmark-item" onclick="searchFromList('${bookmark.word}')">
                <div>
                    <div class="word">${bookmark.word || 'Unknown word'}</div>
                    <div class="date">${formatDate(bookmark.date)}</div>
                </div>
                <button class="remove-btn" onclick="event.stopPropagation(); removeBookmark('${bookmark.word}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    function updateHistoryDisplay() {
        if (!history || history.length === 0) {
            historyList.style.display = 'none';
            emptyHistory.style.display = 'block';
            return;
        }
        
        historyList.style.display = 'block';
        emptyHistory.style.display = 'none';
        
        historyList.innerHTML = history.map(item => `
            <div class="history-item" onclick="searchFromList('${item.word}')">
                <div class="word">${item.word || 'Unknown word'}</div>
                <div class="date">${formatDate(item.date)}</div>
            </div>
        `).join('');
    }

    function formatDate(isoString) {
        if (!isoString) return 'No date';
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (e) {
            return 'Invalid date';
        }
    }

    function highlightText() {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
            try {
                const range = selection.getRangeAt(0);
                const span = document.createElement('span');
                span.className = 'highlight';
                range.surroundContents(span);
                selection.removeAllRanges();
                
                showToast("Text highlighted");
            } catch (e) {
                showToast("Highlighting failed");
                console.error("Highlight error:", e);
            }
        } else {
            showToast("Select text to highlight");
        }
    }

    function showLoading() {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
            wordResult.innerHTML = '';
        }
    }

    function hideLoading() {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }

    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message || 'An unknown error occurred';
            errorMessage.style.display = 'block';
            wordResult.innerHTML = '';
        }
    }

    function hideError() {
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }
    }

    function showToast(message) {
        if (toast) {
            toast.textContent = message || '';
            toast.classList.add('show');
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    }

    // Make functions available globally with safety checks
    window.searchFromList = function(word) {
        if (!word) {
            showToast("No word selected");
            return;
        }
        searchInput.value = word;
        searchWord();
        switchTab('dictionary');
    };

    window.playAudio = playAudio;
    window.highlightText = highlightText;
    window.searchSynonym = function(synonym) {
        if (!synonym) {
            showToast("No synonym selected");
            return;
        }
        searchInput.value = synonym;
        searchWord();
    };

    window.removeBookmark = function(word) {
        if (!word) {
            showToast("No word to remove");
            return;
        }
        bookmarks = bookmarks.filter(b => 
            b.word && b.word.toLowerCase() !== word.toLowerCase()
        );
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        updateBookmarksDisplay();
        
        if (currentWord && word && currentWord.toLowerCase() === word.toLowerCase()) {
            const bookmarkBtns = document.querySelectorAll('.bookmark-btn');
            bookmarkBtns.forEach(btn => {
                if (btn) btn.classList.remove('bookmarked');
            });
        }
        
        showToast("Bookmark removed");
    };

    window.copyDefinition = function(word) {
        if (!word) {
            showToast("No word to copy");
            return;
        }
        
        const definitions = [];
        const definitionElements = document.querySelectorAll('.definition');
        
        if (definitionElements && definitionElements.length > 0) {
            definitionElements.forEach(def => {
                if (def && def.textContent) {
                    definitions.push(def.textContent.trim());
                }
            });
        }
        
        const textToCopy = `${word}\n\n${definitions.join('\n\n')}`;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast("Definition copied to clipboard");
        }).catch(err => {
            showToast("Failed to copy definition");
            console.error('Failed to copy: ', err);
        });
    };

    window.toggleBookmark = toggleBookmark;

    // Initial animations
    if (document.querySelector(".logo")) {
        gsap.from(".logo", {
            opacity: 0,
            x: -20,
            duration: 0.8,
            delay: 0.2
        });
    }

    if (document.querySelector(".search-container")) {
        gsap.from(".search-container", {
            opacity: 0,
            y: 20,
            duration: 0.8,
            delay: 0.4
        });
    }

    if (document.querySelector(".tabs")) {
        gsap.from(".tabs", {
            opacity: 0,
            y: 20,
            duration: 0.8,
            delay: 0.6
        });
    }
});
   