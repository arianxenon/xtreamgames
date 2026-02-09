// cloud-sync.js
// سیستم همگام‌سازی ابری برای Xtream Games
// به تنهایی کار می‌کند - نیازی به تغییر فایل‌های دیگر نیست

(function() {
    'use strict';
    
    console.log('📡 Xtream Cloud Sync Loaded');
    
    const SYNC_VERSION = '1.0';
    const STORAGE_KEY = 'xtream_sync_data';
    const LAST_SYNC_KEY = 'xtream_last_sync';
    const CLOUD_ID_KEY = 'xtream_cloud_id';
    
    // JSONBin.io Configuration (رایگان)
    const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';
    const JSONBIN_MASTER_KEY = '$2a$10$p.ZDN3rL3o8a9NwJFpJvMOhc66ZQz8KQ3rGj5kLm9nB4sVqYt1uWX'; // کلید عمومی نمونه
    
    class CloudSync {
        constructor() {
            this.cloudId = null;
            this.isOnline = navigator.onLine;
            this.isSyncing = false;
            this.init();
        }
        
        init() {
            // Load cloud ID
            this.cloudId = localStorage.getItem(CLOUD_ID_KEY);
            
            // Online/offline detection
            window.addEventListener('online', () => {
                this.isOnline = true;
                console.log('🌐 Online - Auto-syncing...');
                this.autoSync();
            });
            
            window.addEventListener('offline', () => {
                this.isOnline = false;
                console.log('📴 Offline - Working locally');
            });
            
            // Auto-sync every 5 minutes if online
            setInterval(() => {
                if (this.isOnline && !this.isSyncing) {
                    this.autoSync();
                }
            }, 300000);
            
            // Initial auto-sync
            setTimeout(() => this.autoSync(), 5000);
            
            // Inject sync UI
            this.injectSyncUI();
            
            // Monitor localStorage changes
            this.startMonitoring();
        }
        
        startMonitoring() {
            // Listen for changes in xtreamGames
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = function(key, value) {
                originalSetItem.apply(this, arguments);
                
                if (key === 'xtreamGames' || key === 'xtreamGamesMusic') {
                    window.dispatchEvent(new CustomEvent('xtreamDataChanged', {
                        detail: { key, value }
                    }));
                }
            };
            
            window.addEventListener('xtreamDataChanged', (e) => {
                if (this.isOnline) {
                    this.debouncedSync();
                }
            });
        }
        
        debouncedSync = this.debounce(() => {
            if (!this.isSyncing) {
                this.saveToCloud();
            }
        }, 2000);
        
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        injectSyncUI() {
            // Wait for page to load
            setTimeout(() => {
                // Add sync button to header
                const headerActions = document.querySelector('.header-actions');
                if (headerActions && !document.getElementById('cloudSyncBtn')) {
                    const syncBtn = document.createElement('button');
                    syncBtn.id = 'cloudSyncBtn';
                    syncBtn.className = 'share-btn';
                    syncBtn.style.backgroundColor = '#9C27B0';
                    syncBtn.style.marginLeft = '10px';
                    syncBtn.innerHTML = '<i class="fas fa-cloud"></i> Cloud Sync';
                    syncBtn.onclick = () => this.manualSync();
                    
                    headerActions.appendChild(syncBtn);
                    
                    // Add status indicator
                    const statusDiv = document.createElement('div');
                    statusDiv.id = 'syncStatus';
                    statusDiv.style.cssText = `
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        background: var(--secondary-dark);
                        color: white;
                        padding: 10px 15px;
                        border-radius: 8px;
                        border-left: 4px solid var(--accent-blue);
                        font-size: 12px;
                        z-index: 9999;
                        display: none;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    `;
                    document.body.appendChild(statusDiv);
                }
                
                // Add sync option to share modal
                const shareOptions = document.querySelector('.share-options');
                if (shareOptions && !document.getElementById('shareCloud')) {
                    const cloudOption = document.createElement('div');
                    cloudOption.className = 'share-option';
                    cloudOption.id = 'shareCloud';
                    cloudOption.innerHTML = `
                        <i class="fas fa-cloud-upload-alt share-icon" style="color: #9C27B0;"></i>
                        <span>Cloud Backup</span>
                    `;
                    cloudOption.onclick = () => this.showCloudPanel();
                    shareOptions.appendChild(cloudOption);
                }
                
                // Add cloud panel to share modal
                this.injectCloudPanel();
            }, 1000);
        }
        
        injectCloudPanel() {
            const modalBody = document.querySelector('.share-modal-body');
            if (modalBody && !document.getElementById('cloudPanel')) {
                const panel = document.createElement('div');
                panel.id = 'cloudPanel';
                panel.style.cssText = `
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #2a3552;
                    display: none;
                `;
                
                panel.innerHTML = `
                    <h4 style="color: var(--accent-light-blue); margin-bottom: 15px;">
                        <i class="fas fa-cloud"></i> Cloud Backup
                    </h4>
                    
                    <div style="background: var(--card-bg); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <span>Status: <span id="cloudStatusText">Checking...</span></span>
                            <span id="cloudStatusIcon"><i class="fas fa-spinner fa-spin"></i></span>
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <button id="backupNowBtn" class="action-btn" style="flex: 1;">
                                <i class="fas fa-save"></i> Backup Now
                            </button>
                            <button id="restoreBtn" class="action-btn" style="flex: 1; background: rgba(37, 211, 102, 0.8);">
                                <i class="fas fa-download"></i> Restore
                            </button>
                        </div>
                        
                        <div style="margin-top: 15px; font-size: 12px; color: var(--text-secondary);">
                            <div>Last Backup: <span id="lastBackupTime">Never</span></div>
                            <div style="margin-top: 5px;">Cloud ID: <code id="cloudIdDisplay" style="background: rgba(0,0,0,0.3); padding: 2px 5px; border-radius: 3px;">${this.cloudId || 'Not set'}</code></div>
                        </div>
                    </div>
                    
                    <div style="background: var(--card-bg); padding: 15px; border-radius: 8px;">
                        <h5 style="margin-bottom: 10px; color: var(--accent-light-blue);">
                            <i class="fas fa-share-alt"></i> Share Your Collection
                        </h5>
                        <p style="font-size: 13px; margin-bottom: 15px; color: var(--text-secondary);">
                            Generate a shareable link to transfer your games to another device
                        </p>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="shareableLink" readonly 
                                   style="flex: 1; padding: 10px; background: rgba(19,26,45,0.7); 
                                          border: 2px solid #2a3552; border-radius: 8px; color: white;"
                                   placeholder="Generate a share link...">
                            <button id="generateLinkBtn" class="action-btn" style="white-space: nowrap;">
                                <i class="fas fa-link"></i> Generate
                            </button>
                        </div>
                        <button id="loadSharedBtn" class="action-btn" 
                                style="width: 100%; margin-top: 10px; background: rgba(255, 152, 0, 0.8);">
                            <i class="fas fa-file-import"></i> Load from Shared Link
                        </button>
                    </div>
                `;
                
                modalBody.appendChild(panel);
                
                // Attach events
                setTimeout(() => {
                    document.getElementById('backupNowBtn')?.addEventListener('click', () => this.saveToCloud(true));
                    document.getElementById('restoreBtn')?.addEventListener('click', () => this.restoreFromCloud());
                    document.getElementById('generateLinkBtn')?.addEventListener('click', () => this.generateShareLink());
                    document.getElementById('loadSharedBtn')?.addEventListener('click', () => this.loadFromSharedLink());
                }, 100);
            }
        }
        
        showCloudPanel() {
            const panel = document.getElementById('cloudPanel');
            const qrContainer = document.getElementById('qrContainer');
            
            if (panel) {
                panel.style.display = 'block';
                if (qrContainer) qrContainer.style.display = 'none';
                
                // Update status
                this.updateCloudStatus();
            }
        }
        
        updateCloudStatus() {
            const statusText = document.getElementById('cloudStatusText');
            const statusIcon = document.getElementById('cloudStatusIcon');
            const lastBackup = document.getElementById('lastBackupTime');
            const cloudIdDisplay = document.getElementById('cloudIdDisplay');
            
            if (!statusText) return;
            
            if (this.isOnline) {
                statusText.innerHTML = '<span style="color: #25D366;">Online</span>';
                statusIcon.innerHTML = '<i class="fas fa-wifi" style="color: #25D366;"></i>';
            } else {
                statusText.innerHTML = '<span style="color: #FF9800;">Offline</span>';
                statusIcon.innerHTML = '<i class="fas fa-wifi-slash" style="color: #FF9800;"></i>';
            }
            
            // Last backup time
            const lastSync = localStorage.getItem(LAST_SYNC_KEY);
            if (lastSync) {
                const date = new Date(lastSync);
                lastBackup.textContent = date.toLocaleString();
            } else {
                lastBackup.textContent = 'Never';
            }
            
            // Cloud ID
            if (cloudIdDisplay) {
                cloudIdDisplay.textContent = this.cloudId || 'Not set';
            }
        }
        
        showStatus(message, type = 'info', duration = 3000) {
            const statusDiv = document.getElementById('syncStatus');
            if (!statusDiv) return;
            
            const colors = {
                info: '#0066ff',
                success: '#25D366',
                error: '#ff3333',
                warning: '#FF9800'
            };
            
            statusDiv.style.borderLeftColor = colors[type] || colors.info;
            statusDiv.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;
            statusDiv.style.display = 'block';
            
            if (duration > 0) {
                setTimeout(() => {
                    statusDiv.style.display = 'none';
                }, duration);
            }
        }
        
        async manualSync() {
            if (!this.isOnline) {
                this.showStatus('You are offline', 'warning');
                return;
            }
            
            this.showStatus('Syncing with cloud...', 'info', 0);
            
            try {
                await this.saveToCloud(true);
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.loadFromCloud();
                
                this.showStatus('Sync complete!', 'success');
                
                // Reload games list
                if (window.loadGames && typeof window.loadGames === 'function') {
                    window.loadGames();
                }
            } catch (error) {
                this.showStatus('Sync failed: ' + error.message, 'error');
            }
        }
        
        async autoSync() {
            if (!this.isOnline || this.isSyncing) return;
            
            this.isSyncing = true;
            
            try {
                // Load from cloud first
                await this.loadFromCloud();
                
                // Then save to cloud (to update if needed)
                await this.saveToCloud(false);
                
                console.log('🔄 Auto-sync completed');
            } catch (error) {
                console.warn('Auto-sync failed:', error.message);
            } finally {
                this.isSyncing = false;
            }
        }
        
        async saveToCloud(showFeedback = false) {
            if (!this.isOnline) {
                if (showFeedback) this.showStatus('Cannot backup: Offline', 'warning');
                return false;
            }
            
            try {
                const games = JSON.parse(localStorage.getItem('xtreamGames') || '[]');
                const music = JSON.parse(localStorage.getItem('xtreamGamesMusic') || '[]');
                
                const data = {
                    games,
                    musicPlaylist: music,
                    syncVersion: SYNC_VERSION,
                    timestamp: new Date().toISOString(),
                    device: navigator.userAgent.substring(0, 100)
                };
                
                // Generate cloud ID if not exists
                if (!this.cloudId) {
                    this.cloudId = 'xtream_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    localStorage.setItem(CLOUD_ID_KEY, this.cloudId);
                }
                
                // Save locally as backup
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
                
                // Try JSONBin.io
                const response = await fetch(JSONBIN_BASE, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Master-Key': JSONBIN_MASTER_KEY,
                        'X-Bin-Name': `XtreamGames_${this.cloudId}`,
                        'X-Bin-Private': 'false'
                    },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Saved to cloud:', result.metadata.id);
                    
                    if (showFeedback) {
                        this.showStatus('Backup completed!', 'success');
                    }
                    
                    // Update UI
                    this.updateCloudStatus();
                    
                    return true;
                } else {
                    throw new Error('Failed to save to cloud storage');
                }
            } catch (error) {
                console.error('❌ Cloud save error:', error);
                
                if (showFeedback) {
                    this.showStatus('Backup failed', 'error');
                }
                
                // Fallback: Save to localStorage only
                return false;
            }
        }
        
        async loadFromCloud() {
            if (!this.isOnline) return false;
            
            try {
                // Try to load from JSONBin using our cloud ID
                if (!this.cloudId) return false;
                
                const response = await fetch(`${JSONBIN_BASE}/latest`, {
                    method: 'GET',
                    headers: {
                        'X-Master-Key': JSONBIN_MASTER_KEY,
                        'X-Bin-Meta': 'false'
                    }
                });
                
                if (response.ok) {
                    const cloudData = await response.json();
                    
                    // Check if cloud data is valid
                    if (cloudData && cloudData.games && Array.isArray(cloudData.games)) {
                        const localGames = JSON.parse(localStorage.getItem('xtreamGames') || '[]');
                        
                        // Merge strategies: Keep newest version of each game
                        const mergedGames = this.mergeGames(localGames, cloudData.games);
                        const mergedMusic = cloudData.musicPlaylist || [];
                        
                        // Save merged data
                        localStorage.setItem('xtreamGames', JSON.stringify(mergedGames));
                        if (mergedMusic.length > 0) {
                            localStorage.setItem('xtreamGamesMusic', JSON.stringify(mergedMusic));
                        }
                        
                        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
                        
                        console.log('✅ Loaded from cloud:', mergedGames.length, 'games');
                        return true;
                    }
                }
            } catch (error) {
                console.warn('Cloud load failed:', error.message);
            }
            
            return false;
        }
        
        mergeGames(localGames, cloudGames) {
            const gameMap = new Map();
            
            // Add all local games
            localGames.forEach(game => {
                gameMap.set(game.id, game);
            });
            
            // Add or update with cloud games (cloud wins on conflict)
            cloudGames.forEach(cloudGame => {
                const localGame = gameMap.get(cloudGame.id);
                
                if (!localGame) {
                    // New game from cloud
                    gameMap.set(cloudGame.id, cloudGame);
                } else {
                    // Conflict resolution: Use newer game
                    const localTime = new Date(localGame.updatedAt || 0).getTime();
                    const cloudTime = new Date(cloudGame.updatedAt || 0).getTime();
                    
                    if (cloudTime > localTime) {
                        gameMap.set(cloudGame.id, cloudGame);
                    }
                }
            });
            
            return Array.from(gameMap.values());
        }
        
        async generateShareLink() {
            const input = document.getElementById('shareableLink');
            const button = document.getElementById('generateLinkBtn');
            
            if (!input || !button) return;
            
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            button.disabled = true;
            
            try {
                const games = JSON.parse(localStorage.getItem('xtreamGames') || '[]');
                const music = JSON.parse(localStorage.getItem('xtreamGamesMusic') || '[]');
                
                const shareData = {
                    games: games,
                    musicPlaylist: music,
                    sharedAt: new Date().toISOString(),
                    source: 'Xtream Games Share'
                };
                
                // Create a temporary bin for sharing
                const response = await fetch(JSONBIN_BASE, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Master-Key': JSONBIN_MASTER_KEY,
                        'X-Bin-Name': 'Xtream Games Shared Collection',
                        'X-Bin-Private': 'false'
                    },
                    body: JSON.stringify(shareData)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    const binId = result.metadata.id;
                    
                    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${binId}`;
                    input.value = shareUrl;
                    
                    // Select and copy
                    input.select();
                    navigator.clipboard.writeText(shareUrl).then(() => {
                        this.showStatus('Share link copied!', 'success');
                    });
                }
            } catch (error) {
                console.error('Share link generation failed:', error);
                this.showStatus('Failed to generate link', 'error');
            } finally {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        }
        
        async loadFromSharedLink() {
            const shareId = prompt('Enter shared collection ID or full URL:');
            if (!shareId) return;
            
            // Extract ID from URL if full URL provided
            let binId = shareId;
            if (shareId.includes('jsonbin.io')) {
                const match = shareId.match(/jsonbin\.io\/[bv]\/([a-zA-Z0-9]+)/);
                if (match) binId = match[1];
            } else if (shareId.includes('?share=')) {
                const urlParams = new URLSearchParams(shareId.split('?')[1]);
                binId = urlParams.get('share') || shareId;
            }
            
            if (!binId || binId.length < 10) {
                this.showStatus('Invalid share ID', 'error');
                return;
            }
            
            this.showStatus('Loading shared collection...', 'info', 0);
            
            try {
                const response = await fetch(`${JSONBIN_BASE}/${binId}`, {
                    headers: {
                        'X-Master-Key': JSONBIN_MASTER_KEY,
                        'X-Bin-Meta': 'false'
                    }
                });
                
                if (response.ok) {
                    const sharedData = await response.json();
                    
                    if (sharedData && sharedData.games && Array.isArray(sharedData.games)) {
                        // Ask user what to do
                        const choice = confirm(
                            `Found ${sharedData.games.length} games in shared collection.\n\n` +
                            `Click OK to merge with your current games.\n` +
                            `Click Cancel to replace your current games.`
                        );
                        
                        const localGames = JSON.parse(localStorage.getItem('xtreamGames') || '[]');
                        let mergedGames;
                        
                        if (choice) {
                            // Merge
                            mergedGames = this.mergeGames(localGames, sharedData.games);
                        } else {
                            // Replace
                            mergedGames = sharedData.games;
                        }
                        
                        localStorage.setItem('xtreamGames', JSON.stringify(mergedGames));
                        
                        if (sharedData.musicPlaylist && sharedData.musicPlaylist.length > 0) {
                            localStorage.setItem('xtreamGamesMusic', JSON.stringify(sharedData.musicPlaylist));
                        }
                        
                        this.showStatus(`Loaded ${sharedData.games.length} games!`, 'success');
                        
                        // Reload the games list
                        if (window.loadGames && typeof window.loadGames === 'function') {
                            window.loadGames();
                        }
                        
                        // Close modal if open
                        const shareModal = document.getElementById('shareModal');
                        if (shareModal) {
                            shareModal.style.display = 'none';
                            document.body.style.overflow = 'auto';
                        }
                    } else {
                        throw new Error('Invalid shared data format');
                    }
                } else {
                    throw new Error('Failed to load shared collection');
                }
            } catch (error) {
                console.error('Load shared error:', error);
                this.showStatus('Failed to load: ' + error.message, 'error');
            }
        }
        
        async restoreFromCloud() {
            if (!confirm('Restore from cloud backup? This will overwrite your current games.')) {
                return;
            }
            
            this.showStatus('Restoring from cloud...', 'info', 0);
            
            try {
                const success = await this.loadFromCloud();
                
                if (success) {
                    this.showStatus('Restore completed!', 'success');
                    
                    // Reload games
                    if (window.loadGames && typeof window.loadGames === 'function') {
                        window.loadGames();
                    }
                } else {
                    this.showStatus('No cloud backup found', 'warning');
                }
            } catch (error) {
                this.showStatus('Restore failed', 'error');
            }
        }
    }
    
    // Initialize when page loads
    window.addEventListener('load', () => {
        window.xtreamCloudSync = new CloudSync();
        
        // Check for shared link in URL
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('share');
        if (shareId && window.xtreamCloudSync) {
            setTimeout(() => {
                if (confirm('Load shared games collection?')) {
                    window.xtreamCloudSync.loadFromSharedLink(shareId);
                }
            }, 1500);
        }
    });
    
    // Global functions for manual control
    window.backupToCloud = function() {
        if (window.xtreamCloudSync) {
            window.xtreamCloudSync.saveToCloud(true);
        }
    };
    
    window.syncFromCloud = function() {
        if (window.xtreamCloudSync) {
            window.xtreamCloudSync.manualSync();
        }
    };
    
    console.log('✅ Xtream Cloud Sync System Ready');
})();
