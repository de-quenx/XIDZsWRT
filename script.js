const apiURL = "./releases.json";
let builds = [];
let selectedFirmware = null;
let userIP = null;
let countdownInterval = null;

async function getUserIP() {
    try {
        const response = await fetch("https://api64.ipify.org?format=json");
        const data = await response.json();
        userIP = data.ip;
    } catch (error) {
        userIP = "unknown";
    }
}

function cleanFileName(filename) {
    if (filename.toLowerCase().includes("modsdcard")) {
        let name = filename.replace(/-\d{8}-MODSDCARD\.(img\.gz|tar\.gz|tar\.xz|bin\.gz|img|bin|gz|tar|zip|xz|7z|bz2)$/gi, "-MODSDCARD");
        return name;
    }
    let name = filename.replace(/-\d{8}\.(img\.gz|tar\.gz|tar\.xz|bin\.gz|img|bin|gz|tar|zip|xz|7z|bz2)$/gi, "");
    return name;
}

function getFirmwareCategory(filename) {
    const lower = filename.toLowerCase();
    return (lower.includes("immortalwrt") || lower.includes("immortal")) ? "immortalwrt" : "openwrt";
}

function getDeviceCategory(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes("orangepi") || lower.includes("orange-pi")) return "orangepi";
    if (lower.includes("nanopi") || lower.includes("nano-pi")) return "nanopi";
    if (lower.includes("raspberry") || lower.includes("rpi") || lower.includes("bcm27")) return "raspberrypi";
    if (lower.includes("x86_64") || lower.includes("x86-64") || lower.includes("amd64")) return "x86_64";
    if (lower.includes("amlogic") || lower.includes("s905") || lower.includes("s912") || lower.includes("s922") || lower.includes("a311d") || lower.includes("hg680p") || lower.includes("b860h") || lower.includes("tx3") || lower.includes("h96")) return "amlogic";
    return "amlogic";
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDownloadCount(count) {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function adjustDownloadCount(firmwareUrl, originalCount) {
    if (!userIP) return originalCount;
    const downloadedKey = `downloaded_${firmwareUrl}_${userIP}`;
    if (localStorage.getItem(downloadedKey)) {
        return originalCount > 0 ? originalCount - 1 : 0;
    }
    return originalCount;
}

function getDownloadTimeLeft() {
    if (!userIP) return 0;
    const key = `download_delay_${userIP}`;
    const lastDownload = localStorage.getItem(key);
    if (!lastDownload) return 0;
    const timeDiff = Date.now() - parseInt(lastDownload);
    const oneMinute = 1 * 60 * 1000;
    const timeLeft = oneMinute - timeDiff;
    return timeLeft > 0 ? timeLeft : 0;
}

function canDownload() {
    return getDownloadTimeLeft() === 0;
}

function setDownloadDelay() {
    if (!userIP) return;
    const key = `download_delay_${userIP}`;
    localStorage.setItem(key, Date.now().toString());
}

function formatTime(milliseconds) {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function updateDownloadButton() {
    const downloadBtn = document.getElementById("downloadBtn");
    if (!selectedFirmware || !downloadBtn) return;
    
    const timeLeft = getDownloadTimeLeft();
    
    if (timeLeft > 0) {
        downloadBtn.textContent = `Tunggu... ${formatTime(timeLeft)}`;
        downloadBtn.className = "download-btn locked";
        downloadBtn.disabled = true;
        downloadBtn.style.pointerEvents = "none";
        downloadBtn.style.cursor = "not-allowed";
    } else {
        downloadBtn.textContent = "Download";
        downloadBtn.className = "download-btn unlocked";
        downloadBtn.disabled = false;
        downloadBtn.style.pointerEvents = "auto";
        downloadBtn.style.cursor = "pointer";
    }
}

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
        updateDownloadButton();
        
        const timeLeft = getDownloadTimeLeft();
        if (timeLeft === 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }, 1000);
}

function checkAndStartCountdown() {
    const timeLeft = getDownloadTimeLeft();
    if (timeLeft > 0) {
        startCountdown();
    }
}

function cleanup() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

function initThemeSystem() {
    const themes = [
        { name: 'neomorp', label: 'Light' },
        { name: 'dark', label: 'Dark' },
        { name: 'blue', label: 'Blue' },
        { name: 'green', label: 'Green' },
        { name: 'purple', label: 'Purple' }
    ];
    
    let currentIndex = 0;
    const savedTheme = localStorage.getItem('xidzs-theme') || 'neomorp';
    currentIndex = themes.findIndex(t => t.name === savedTheme);
    if (currentIndex === -1) currentIndex = 0;
    
    const themeToggle = document.getElementById('themeToggle');
    
    function updateTheme() {
        const theme = themes[currentIndex];
        applyTheme(theme.name);
        if (themeToggle) themeToggle.textContent = theme.label;
        localStorage.setItem('xidzs-theme', theme.name);
    }
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % themes.length;
            updateTheme();
        });
    }
    
    updateTheme();
}

function applyTheme(themeName) {
    document.body.classList.remove('theme-dark', 'theme-blue', 'theme-green', 'theme-purple');
    if (themeName !== 'neomorp') {
        document.body.classList.add(`theme-${themeName}`);
    }
}

function showEmptyState(message) {
    const firmwareCountElement = document.getElementById("firmwareCount");
    const searchBtnElement = document.getElementById("searchBtn");
    const wizard = document.getElementById("wizard");
    
    if (firmwareCountElement) {
        firmwareCountElement.textContent = message;
    }
    if (searchBtnElement) {
        searchBtnElement.textContent = "Pencarian";
    }
    
    if (wizard) {
        wizard.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: #666;">
                <h3>${message}</h3>
                <p>Comingsoon Yah Sayang</p>
                <button onclick="initApp()" style="margin-top: 15px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Sabar Yah
                </button>
            </div>
        `;
    }
}

function showError(message) {
    const firmwareCountElement = document.getElementById("firmwareCount");
    const searchBtnElement = document.getElementById("searchBtn");
    const wizard = document.getElementById("wizard");
    
    if (firmwareCountElement) {
        firmwareCountElement.textContent = "Error Loading Firmware";
    }
    if (searchBtnElement) {
        searchBtnElement.textContent = "Pencarian";
    }
    
    if (wizard) {
        wizard.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 40px; color: #ff6b6b;">
                <h3>Firmware Belum Tersedia Sayang</h3>
                <p>Error: ${message}</p>
                <button onclick="initApp()" style="margin-top: 15px; padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Coba Lagi Nanti
                </button>
            </div>
        `;
    }
}

async function loadData() {
    try {
        const res = await fetch(apiURL, { 
            cache: "no-cache",
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        let releases;
        try {
            releases = await res.json();
        } catch (jsonError) {
            throw new Error('Invalid JSON response');
        }
        
        if (!releases) {
            throw new Error('No data received');
        }
        
        if (releases.message) {
            throw new Error(releases.message);
        }
        
        if (!Array.isArray(releases)) {
            throw new Error('Invalid data format - expected array');
        }
        
        if (releases.length === 0) {
            showEmptyState("Tidak ada firmware ditemukan");
            return;
        }
        
        builds = [];
        releases.forEach(rel => {
            if (!rel.assets || rel.assets.length === 0) {
                return;
            }
            
            rel.assets.forEach(asset => {
                if (!asset.name || !asset.browser_download_url) return;
                
                if (!asset.name.match(/\.(img|bin|gz|tar|zip|xz|7z|img\.gz|tar\.gz|tar\.xz|bin\.gz|bz2)$/i)) return;
                
                if (asset.name.toLowerCase().includes("rootfs")) return;
                
                const cleanName = cleanFileName(asset.name);
                if (!cleanName) return;
                
                builds.push({
                    displayName: cleanName,
                    originalName: asset.name,
                    category: getFirmwareCategory(asset.name),
                    device: getDeviceCategory(asset.name),
                    url: asset.browser_download_url,
                    size: asset.size || 0,
                    downloadCount: typeof asset.download_count === "number" ? asset.download_count : 0,
                    publishedAt: rel.published_at || rel.created_at || null
                });
            });
        });
        
        if (builds.length === 0) {
            showEmptyState("Tidak ada firmware ditemukan");
            return;
        }
        
        const uniqueBuilds = [];
        const seen = new Set();
        builds.forEach(b => {
            const n = b.displayName.toLowerCase().trim();
            if (!seen.has(n) && n.length > 0) {
                seen.add(n);
                uniqueBuilds.push(b);
            }
        });
        builds = uniqueBuilds;
        
        const firmwareCountElement = document.getElementById("firmwareCount");
        const searchBtnElement = document.getElementById("searchBtn");
        
        if (firmwareCountElement) {
            firmwareCountElement.textContent = `${builds.length} Firmware Tersedia`;
        }
        if (searchBtnElement) {
            searchBtnElement.textContent = `Pencarian`;
        }
        
        initWizard();
        
    } catch (error) {
        console.error("Error loading firmware data:", error);
        showError(error.message);
    }
}

function initWizard() {
    const wizard = document.getElementById("wizard");
    if (!wizard) return;
    
    const allCount = builds.length;
    const openwrtCount = builds.filter(b => b.category === 'openwrt').length;
    const immortalCount = builds.filter(b => b.category === 'immortalwrt').length;
    
    const amlogicCount = builds.filter(b => b.device === 'amlogic').length;
    const orangepiCount = builds.filter(b => b.device === 'orangepi').length;
    const nanopiCount = builds.filter(b => b.device === 'nanopi').length;
    const raspberrypiCount = builds.filter(b => b.device === 'raspberrypi').length;
    const x86Count = builds.filter(b => b.device === 'x86_64').length;
    
    wizard.innerHTML = `
        <div class="step-card active">
            <label>Pilih Kategori Firmware:</label>
            <div class="category-buttons">
                <button class="category-btn active" data-category="all">Semua (${allCount})</button>
                <button class="category-btn" data-category="openwrt">OpenWrt (${openwrtCount})</button>
                <button class="category-btn" data-category="immortalwrt">ImmortalWrt (${immortalCount})</button>
            </div>
        </div>
        <div class="step-card active">
            <label>Pilih Device:</label>
            <div class="device-buttons">
                <button class="device-btn active" data-device="all">Semua</button>
                <button class="device-btn" data-device="amlogic">Amlogic (${amlogicCount})</button>
                <button class="device-btn" data-device="orangepi">OrangePi (${orangepiCount})</button>
                <button class="device-btn" data-device="nanopi">NanoPi (${nanopiCount})</button>
                <button class="device-btn" data-device="raspberrypi">RaspberryPi (${raspberrypiCount})</button>
                <button class="device-btn" data-device="x86_64">X86_64 (${x86Count})</button>
            </div>
        </div>
        <div class="step-card active">
            <div class="firmware-header">
                <label>Firmware:</label>
                <button class="search-toggle-btn" onclick="toggleSearch()">Cari</button>
            </div>
            <div class="search-select" style="display: none;">
                <input type="text" placeholder="Cari Firmware Devices..." />
            </div>
            <div class="firmware-list"><ul></ul></div>
        </div>
        <div class="step-card active">
            <div class="locked-download-section">
                <div class="download-area">
                    <div class="selected-info">
                        <div class="no-selection"><p>Pilih Firmware Terlebih Dahulu</p></div>
                    </div>
                    <div class="action-buttons">
                        <button class="download-btn locked" id="downloadBtn" onclick="handleDownload()">Download</button>
                        <div class="info-buttons">
                            <button class="info-btn" onclick="openModal('infoModal')">Informasi</button>
                            <button class="features-btn" onclick="openModal('featuresModal')">Features</button>
                            <button class="about-btn" onclick="openModal('aboutModal')">About</button>
                            <button class="sumber-btn" onclick="openModal('sumberModal')">Sumber & Credit</button>
                            <button class="changelog-btn" onclick="openModal('changelogModal')">Changelog</button>
                            <button class="owner-btn" onclick="openModal('ownerModal')">Owner</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    setupEventHandlers();
}

function setupEventHandlers() {
    const ul = document.querySelector(".firmware-list ul");
    const input = document.querySelector(".search-select input");
    
    if (!ul || !input) return;
    
    let currentCategory = "all";
    let currentDevice = "all";

    document.querySelectorAll(".category-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentCategory = btn.dataset.category;
            input.value = "";
            selectedFirmware = null;
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            updateDownloadSection();
            renderList("");
        };
    });

    document.querySelectorAll(".device-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".device-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentDevice = btn.dataset.device;
            input.value = "";
            selectedFirmware = null;
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            updateDownloadSection();
            renderList("");
        };
    });

    function renderList(filter = "") {
        ul.innerHTML = "";
        let filtered = builds;
        
        if (currentCategory !== "all") {
            filtered = filtered.filter(b => b.category === currentCategory);
        }
        
        if (currentDevice !== "all") {
            filtered = filtered.filter(b => b.device === currentDevice);
        }
        
        const searchFiltered = filtered.filter(b => b.displayName.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => {
            const dateA = new Date(a.publishedAt || 0);
            const dateB = new Date(b.publishedAt || 0);
            return dateB - dateA;
        });

        if (searchFiltered.length === 0) {
            ul.innerHTML = '<li style="text-align:center;color:var(--secondary-color);cursor:default;">Tidak ada firmware yang ditemukan</li>';
            return;
        }
        
        searchFiltered.forEach(b => {
            const li = document.createElement("li");
            li.innerHTML = `
                <div class="firmware-info">
                    <div class="firmware-name">${b.displayName}</div>
                    <div class="firmware-meta">
                        <span class="device-type">${b.device.toUpperCase()}</span>
                        <span class="file-size">Size: ${formatFileSize(b.size)}</span>
                        <span class="download-count">Downloads: ${formatDownloadCount(adjustDownloadCount(b.url, b.downloadCount))}</span>
                        <span class="release-date">Date: ${formatDate(b.publishedAt)}</span>
                    </div>
                </div>`;
            li.onclick = () => {
                ul.querySelectorAll("li").forEach(li => li.classList.remove("selected"));
                selectedFirmware = b;
                li.classList.add("selected");
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }
                updateDownloadSection();
                updateDownloadButton();
                
                const timeLeft = getDownloadTimeLeft();
                if (timeLeft > 0) {
                    startCountdown();
                }
            };
            ul.appendChild(li);
        });
    }

    function updateDownloadSection() {
        const selectedInfo = document.querySelector(".selected-info");
        const downloadBtn = document.getElementById("downloadBtn");
        
        if (!selectedInfo || !downloadBtn) return;
        
        if (selectedFirmware) {
            selectedInfo.innerHTML = `
                <div class="firmware-selected">
                    <div class="firmware-details">
                        <strong>${selectedFirmware.displayName}</strong><br>
                        <small>Category: ${selectedFirmware.category.toUpperCase()}</small><br>
                        <small>Device: ${selectedFirmware.device.toUpperCase()}</small><br>
                        <small style="color: var(--secondary-color);">File: ${selectedFirmware.originalName}</small>
                        <span class="file-size">Size: ${formatFileSize(selectedFirmware.size)}</span>
                        <span class="download-count">Downloads: ${formatDownloadCount(adjustDownloadCount(selectedFirmware.url, selectedFirmware.downloadCount))}</span>
                        <span class="release-date">Date: ${formatDate(selectedFirmware.publishedAt)}</span>
                    </div>
                    <div class="download-url">${selectedFirmware.url}</div>
                </div>`;
            downloadBtn.textContent = "Download";
            downloadBtn.className = "download-btn unlocked";
        } else {
            selectedInfo.innerHTML = '<div class="no-selection"><p>Pilih Firmware Terlebih Dahulu</p></div>';
            downloadBtn.textContent = "Download";
            downloadBtn.className = "download-btn locked";
        }
    }

    renderList();
    input.oninput = () => renderList(input.value);
    updateDownloadSection();
    checkAndStartCountdown();
}

function handleDownload() {
    if (!selectedFirmware) return;
    
    if (!canDownload()) {
        return;
    }
    
    const downloadedKey = `downloaded_${selectedFirmware.url}_${userIP}`;
    const wasDownloaded = localStorage.getItem(downloadedKey);
    
    if (!wasDownloaded) {
        localStorage.setItem(downloadedKey, "true");
    }
    
    setDownloadDelay();
    startCountdown();
    
    window.open(selectedFirmware.url, "_blank");
}

function toggleSearch() {
    const searchSelect = document.querySelector(".search-select");
    const toggleBtn = document.querySelector(".search-toggle-btn");
    
    if (!searchSelect || !toggleBtn) return;
    
    if (searchSelect.style.display === "none") {
        searchSelect.style.display = "block";
        toggleBtn.textContent = "Tutup";
        toggleBtn.classList.add("active");
    } else {
        searchSelect.style.display = "none";
        toggleBtn.textContent = "Cari";
        toggleBtn.classList.remove("active");
        const input = searchSelect.querySelector("input");
        if (input) {
            input.value = "";
            input.dispatchEvent(new Event('input'));
        }
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    const wizardContainer = document.querySelector('.wizard-container');
    
    if (!modal) return;
    
    if (wizardContainer) {
        wizardContainer.classList.add('blur-active');
    }
    modal.style.display = "block";
    setTimeout(() => modal.classList.add('show'), 10);
}

function closeModal(modal) {
    const wizardContainer = document.querySelector('.wizard-container');
    
    if (wizardContainer) {
        wizardContainer.classList.remove('blur-active');
    }
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = "none", 300);
}

async function initApp() {
    try {
        await getUserIP();
        await loadData();
    } catch (error) {
        console.error("Error initializing app:", error);
        showError("Failed to initialize application");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    initThemeSystem();
    
    const searchBtn = document.getElementById("searchBtn");
    if (searchBtn) {
        searchBtn.onclick = () => {
            const wizard = document.getElementById("wizard");
            if (wizard) {
                wizard.scrollIntoView({ behavior: 'smooth' });
            }
        };
    }
    
    document.querySelectorAll(".close").forEach(btn => {
        btn.onclick = function() { 
            const modal = this.closest(".modal");
            if (modal) closeModal(modal);
        };
    });
    
    window.onclick = e => {
        if (e.target.classList.contains("modal")) closeModal(e.target);
    };
    
    window.addEventListener('beforeunload', cleanup);
    
    checkAndStartCountdown();
    
    await initApp();
});