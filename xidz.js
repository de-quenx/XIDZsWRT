const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loading = document.getElementById('loading');
const notification = document.getElementById('notification');
const notifText = document.getElementById('notifText');
const progressBar = document.getElementById('progressBar');
const togglePassword = document.getElementById('togglePassword');

let attemptCount = 0;
let isLocked = false;
let lockTimer = null;

function getStorageData(key) {
    try {
        return localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch (e) {
        return sessionStorage.getItem(key);
    }
}

function setStorageData(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        sessionStorage.setItem(key, value);
    }
}

const validationRules = {
    minLength: 8,
    maxAttempts: 1,
    normalLockDuration: 120000,
    profanityLockDuration: 780000,
    minPasswords: 1,
    maxPasswords: 1
};

function removeStorageData(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        sessionStorage.removeItem(key);
    }
}

attemptCount = parseInt(getStorageData('attemptCount')) || 0;

const profanityWords = ['616e6a696e67','6d6f6e796574','62616269','746f6c6f6c','6e616a6973','62656f67','676f626c6f6b','746169','62616e67736174','7369616c616e','6261686c696c','736574616e','69626c6973','6b65686564','63656c656e67','6d656d656b','6b6f6e746f6c','6974696c','6c6f6e7465','70656c6572'];

function decodeHex(hex) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}

function checkProfanity(password) {
    const lowerPassword = password.toLowerCase();
    return profanityWords.some(hex => lowerPassword.includes(decodeHex(hex)));
}

function initializeBackupKeys() {
    const keyDatabase = ['434F4D505554455257525254','46495245574F524B4E4554','4249534D494C4C4148','5041535357544F4B454E','524F555445524157525254','4C554349535452414E474B','47414D494E474D4F444552','414C48414D44554C494C4C4148','4D455255424155524F5554','4A414B41524B4F4E4E45','42414E44554E474B4F54','4E5553414E54415253554E','4245525359554B5552','5752544E4554464952454E','4649524552495652534C','494E444F5754524E4554','524F555445524C4F474951','4E4554574F524B52554E','555345525052494E5453','53555241424159444547','53454D4152414E475754','4D414C414E47555047','424F474F52484F5354','4D45444155524142','50414C454D42414E47424B','4D414B415353415252504C','50414E434153494C415247','4D45524445474F4C4445','4C4150414E47534356','4B414D554E414E5941','50454A55414E475445','424947494E544F5452','534F4C4F535552414B','504F4E5449414B454C','4D414E4144495357544E','474F524F4E54414C4448','50414C554E45545453','434F4E4649524D5443','424152414E474B414B','4B4552454E474B414D','4C4F4B414C4946574E','42554B414E59424554','474F54414D414B4152','4152454E414E53565254','5455434F4E475050','4D4F4E5441494E4647','4649524E414E574E','5255524F4E47474F','474F5645544E454554','50524F56494E53445354','53494150414B4148474F','4B454E4150414B414856','44494D414E414B414856','4B415041484B41485452','42494C414D414E41524B','4B454D414E414B41485448','42414741494D414E415352','4D454E47415041464442','42455247554E41424152','41504B41484B414854','4D414E414B41484754','42494C414B414852','4B415041414E4B4148544E','53494150414B41545252','4245524150415453574E'];
    
    const validKeys = [keyDatabase[2],keyDatabase[12],keyDatabase[29]];
    
    const shuffled = validKeys.sort(() => 0.5 - Math.random());
    const selectedCount = Math.floor(Math.random() * (validationRules.maxPasswords - validationRules.minPasswords + 1)) + validationRules.minPasswords;
    
    return shuffled.slice(0, selectedCount);
}

function resetAuthenticationKeys() {
    const newActivePasswords = initializeBackupKeys();
    setStorageData('activePasswords', JSON.stringify(newActivePasswords));
    return newActivePasswords;
}

let activePasswords;
const storedPasswords = getStorageData('activePasswords');
if (storedPasswords) {
    activePasswords = JSON.parse(storedPasswords);
} else {
    activePasswords = initializeBackupKeys();
    setStorageData('activePasswords', JSON.stringify(activePasswords));
}

function checkButtonState() {
    if (passwordInput && loginBtn) {
        if (passwordInput.value.trim().length > 0 && !isLocked) {
            loginBtn.disabled = false;
            loginBtn.style.opacity = '1';
            loginBtn.style.cursor = 'pointer';
        } else {
            loginBtn.disabled = true;
            loginBtn.style.opacity = '0.5';
            loginBtn.style.cursor = 'not-allowed';
        }
    }
}

passwordInput.addEventListener('input', function() {
    passwordInput.classList.remove('input-error', 'input-success');
    checkButtonState();
});

togglePassword.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const currentType = passwordInput.getAttribute('type');
    const newType = currentType === 'password' ? 'text' : 'password';
    
    passwordInput.setAttribute('type', newType);
    this.textContent = newType === 'password' ? '○' : '●';
    
    this.style.transform = 'translateY(-50%) scale(0.8)';
    setTimeout(() => {
        this.style.transform = 'translateY(-50%) scale(1)';
    }, 150);
    
    passwordInput.focus();
});

function showNotification(type, message) {
    notification.classList.remove('show', 'success', 'error');
    progressBar.classList.remove('success', 'error');
    
    progressBar.style.width = '0%';
    
    notification.className = `notification ${type}`;
    notifText.textContent = message;
    progressBar.className = `progress-bar ${type}`;
    
    notification.offsetHeight;
    
    notification.classList.add('show');
    
    setTimeout(() => {
        progressBar.style.width = '100%';
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            progressBar.style.width = '0%';
        }, 400);
    }, 3000);
}

function showLoading(show) {
    if (show) {
        loginBtn.style.display = 'none';
        loading.style.display = 'block';
        passwordInput.disabled = true;
        togglePassword.style.pointerEvents = 'none';
        togglePassword.style.opacity = '0.5';
    } else {
        loginBtn.style.display = 'block';
        loading.style.display = 'none';
        passwordInput.disabled = false;
        togglePassword.style.pointerEvents = 'auto';
        togglePassword.style.opacity = '1';
        checkButtonState();
    }
}

function encodePassword(str) {
    return str.split('').map(c => c.charCodeAt(0).toString(16).toUpperCase()).join('');
}

function getAllowedKeys() {
    return activePasswords;
}

function checkPassword(encodedPassword) {
    const allowedKeys = getAllowedKeys();
    return allowedKeys.includes(encodedPassword);
}

function setCookie(name, value, minutes) {
    const date = new Date();
    date.setTime(date.getTime() + (minutes * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/;SameSite=Strict";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function lockLogin(lockDuration, lockType) {
    isLocked = true;
    passwordInput.disabled = true;
    loginBtn.disabled = true;
    togglePassword.style.pointerEvents = 'none';
    togglePassword.style.opacity = '0.5';
    checkButtonState();
    
    const lockEndTime = Date.now() + lockDuration;
    setStorageData('lockEndTime', lockEndTime);
    setStorageData('lockType', lockType);
    setCookie('lockEndTime', lockEndTime, 10);
    setCookie('lockType', lockType, 10);
    setCookie('attemptCount', attemptCount, 10);
    
    if (lockType !== 'profanity') {
        attemptCount = 0;
        setStorageData('attemptCount', attemptCount);
    }
    
    updateLockTimer();
}

function updateLockTimer() {
    let lockEndTime = parseInt(getStorageData('lockEndTime'));
    let lockType = getStorageData('lockType');
    
    if (!lockEndTime) {
        lockEndTime = parseInt(getCookie('lockEndTime'));
        lockType = getCookie('lockType');
    }
    if (!lockEndTime) return;
    
    const now = Date.now();
    const remainingTime = Math.ceil((lockEndTime - now) / 1000);
    
    if (remainingTime > 0) {
        isLocked = true;
        passwordInput.disabled = true;
        loginBtn.disabled = true;
        togglePassword.style.pointerEvents = 'none';
        togglePassword.style.opacity = '0.5';
        checkButtonState();
        
        if (lockTimer) clearInterval(lockTimer);
        
        const lockMessage = `Terlalu banyak percobaan! Tunggu ${formatTime(remainingTime)}.`;
        
        notification.classList.remove('success');
        notification.classList.add('error', 'show');
        notifText.textContent = lockMessage;
        progressBar.classList.remove('success');
        progressBar.classList.add('error');
        progressBar.style.width = '100%';
        
        lockTimer = setInterval(() => {
            const now = Date.now();
            const remaining = Math.ceil((lockEndTime - now) / 1000);
            if (remaining > 0) {
                notifText.textContent = `Terlalu banyak percobaan! Tunggu ${formatTime(remaining)}.`;
            } else {
                clearInterval(lockTimer);
                lockTimer = null;
                isLocked = false;
                attemptCount = 0;
                passwordInput.disabled = false;
                loginBtn.disabled = false;
                togglePassword.style.pointerEvents = 'auto';
                togglePassword.style.opacity = '1';
                notification.classList.remove('show');
                removeStorageData('lockEndTime');
                removeStorageData('lockType');
                removeStorageData('attemptCount');
                deleteCookie('lockEndTime');
                deleteCookie('lockType');
                deleteCookie('attemptCount');
                
                activePasswords = resetAuthenticationKeys();
                checkButtonState();
                
                setTimeout(() => {
                    progressBar.style.width = '0%';
                }, 400);
            }
        }, 1000);
    } else {
        isLocked = false;
        attemptCount = 0;
        passwordInput.disabled = false;
        loginBtn.disabled = false;
        togglePassword.style.pointerEvents = 'auto';
        togglePassword.style.opacity = '1';
        removeStorageData('lockEndTime');
        removeStorageData('lockType');
        removeStorageData('attemptCount');
        deleteCookie('lockEndTime');
        deleteCookie('lockType');
        deleteCookie('attemptCount');
        
        activePasswords = resetAuthenticationKeys();
        checkButtonState();
    }
}

window.addEventListener('load', function() {
    const cookieAttempt = getCookie('attemptCount');
    if (cookieAttempt) {
        attemptCount = parseInt(cookieAttempt);
    }
    updateLockTimer();
    checkButtonState();
});

loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    if (isLocked || passwordInput.value.trim().length === 0) {
        return;
    }
    
    const password = passwordInput.value.trim();
    
    if (checkProfanity(password)) {
        showLoading(true);
        setTimeout(() => {
            passwordInput.classList.add('input-error');
            passwordInput.classList.remove('input-success');
            passwordInput.value = '';
            passwordInput.setAttribute('type', 'password');
            togglePassword.textContent = '○';
            
            activePasswords = resetAuthenticationKeys();
            
            showLoading(false);
            lockLogin(validationRules.profanityLockDuration, 'profanity');
        }, 1000);
        return;
    }
    
    const encodedPassword = encodePassword(password);
    
    showLoading(true);
    setTimeout(() => {
        if (checkPassword(encodedPassword)) {
            passwordInput.classList.add('input-success');
            passwordInput.classList.remove('input-error');
            attemptCount = 0;
            removeStorageData('attemptCount');
            removeStorageData('lockEndTime');
            removeStorageData('lockType');
            deleteCookie('attemptCount');
            deleteCookie('lockEndTime');
            deleteCookie('lockType');
            
            activePasswords = resetAuthenticationKeys();
            
            showNotification('success', 'Password benar! Mengalihkan...');
            
            setTimeout(() => {
                sessionStorage.setItem('isAuthenticated', 'true');
                window.location.href = 'index.html';
            }, 1500);
        } else {
            attemptCount++;
            setStorageData('attemptCount', attemptCount);
            setCookie('attemptCount', attemptCount, 1);
            passwordInput.classList.add('input-error');
            passwordInput.classList.remove('input-success');
            passwordInput.value = '';
            passwordInput.setAttribute('type', 'password');
            togglePassword.textContent = '○';
            
            activePasswords = resetAuthenticationKeys();
            
            if (attemptCount >= validationRules.maxAttempts) {
                showLoading(false);
                lockLogin(validationRules.normalLockDuration, 'normal');
                return;
            }
            showNotification('error', 'Password salah! Silakan coba lagi.');
            setTimeout(() => {
                passwordInput.classList.remove('input-error');
            }, 3000);
        }
        showLoading(false);
    }, 1000);
});

passwordInput.addEventListener('focus', function() {
    this.style.transform = 'scale(1.02)';
});

passwordInput.addEventListener('blur', function() {
    this.style.transform = 'scale(1)';
});

document.addEventListener('DOMContentLoaded', function() {
    checkButtonState();
    passwordInput.focus();
    if (performance.navigation && performance.navigation.type === performance.navigation.TYPE_RELOAD) {
        passwordInput.value = '';
        passwordInput.setAttribute('type', 'password');
        togglePassword.textContent = '○';
        checkButtonState();
    }
});

passwordInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !isLocked && passwordInput.value.trim().length > 0) {
        loginForm.dispatchEvent(new Event('submit'));
    }
});

passwordInput.addEventListener('paste', function(e) {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    if (pastedText && !isLocked) {
        this.value = pastedText.trim();
        this.dispatchEvent(new Event('input'));
    }
});

document.addEventListener('visibilitychange', function() {
    if (!document.hidden && passwordInput) {
        setTimeout(() => {
            passwordInput.focus();
        }, 100);
    }
});

window.addEventListener('beforeunload', function() {
    if (passwordInput && passwordInput.value) {
        passwordInput.value = '';
    }
});

function preventRightClick() {
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });
}

function preventDevTools() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || (e.ctrlKey && e.shiftKey && e.key === 'C') || (e.ctrlKey && e.key === 'U') || (e.ctrlKey && e.shiftKey && e.key === 'J')) {
            e.preventDefault();
            return false;
        }
    });
}

preventRightClick();
preventDevTools();

setInterval(function() {
    if (window.outerWidth - window.innerWidth > 200 || window.outerHeight - window.innerHeight > 200) {
        document.body.innerHTML = '<div style="text-align:center;margin-top:50vh;transform:translateY(-50%);font-family:Arial,sans-serif;color:#333;">Akses Terblokir</div>';
    }
}, 500);

window.addEventListener('focus', function() {
    if (passwordInput && !passwordInput.disabled) {
        setTimeout(() => {
            passwordInput.focus();
        }, 100);
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            if (passwordInput && !passwordInput.disabled) {
                passwordInput.focus();
            }
        }, 200);
    });
} else {
    setTimeout(() => {
        if (passwordInput && !passwordInput.disabled) {
            passwordInput.focus();
        }
    }, 200);
}

const announcements = [
    "Selamat datang di XIDZs-WRT! Nikmati Firmware Custom Terbaik Stabil Dan anti ribet anti drama bener dah...Tapi Boong...wkwkwk.",
    "Ingatlah waktu sholat hari ini. Jangan sampai terlewatkan kewajiban kita kepada Allah SWT.",
    "Kebaikan sekecil apapun sangat berarti. Teruslah berbuat baik dan saling membantu sesama.",
    "Mari berbagi kebahagiaan dengan sesama. Setiap kebaikan yang kita bagikan akan kembali berlipat ganda.",
    "Keberkahan datang dari rasa syukur dan keikhlasan hati. Semoga hari ini penuh berkah untuk kita semua.",
    "Kata-kata yang baik adalah sedekah. Hindarilah kata-kata kotor yang melukai hati dan menurunkan martabat kita.",
    "Kesabaran adalah kunci kesuksesan. Orang yang sabar akan mendapatkan hasil yang indah di akhir perjuangannya.",
    "Kesombongan adalah awal dari kejatuhan. Rendah hati dan tawadhu adalah jalan menuju kemuliaan sejati.",
    "Jagalah lisanmu dari perkataan buruk. Lisan yang terjaga adalah cerminan hati yang bersih dan pikiran yang jernih.",
    "Sabar dalam menghadapi ujian adalah tanda keimanan yang kuat. Allah bersama orang-orang yang sabar.",
    "Orang yang sombong tidak akan masuk surga. Tawadhu dan merendahkan diri adalah sifat orang-orang mulia.",
    "Perkataan baik membawa kebaikan, perkataan buruk membawa keburukan. Pilihlah kata-kata dengan bijaksana."
];

let currentAnnouncementIndex = 0;
let announcementInterval;

function typeText(text, element, callback) {
    element.textContent = '';
    let index = 0;
    
    function type() {
        if (index < text.length) {
            element.textContent += text.charAt(index);
            index++;
            setTimeout(type, 30);
        } else if (callback) {
            callback();
        }
    }
    
    type();
}

function showAnnouncement() {
    const announcement = document.getElementById('announcement');
    const typingText = document.getElementById('typingText');
    
    if (!announcement || !typingText) return;
    
    announcement.classList.remove('show');
    
    setTimeout(() => {
        typeText(announcements[currentAnnouncementIndex], typingText, () => {
            announcement.classList.add('show');
            
            setTimeout(() => {
                announcement.classList.remove('show');
                
                setTimeout(() => {
                    currentAnnouncementIndex = (currentAnnouncementIndex + 1) % announcements.length;
                    showAnnouncement();
                }, 1000);
            }, 5000);
        });
    }, 200);
}

setTimeout(() => {
    showAnnouncement();
}, 1000);

function createSnowflakes() {
    const snowflakes = document.querySelectorAll('.snowflake');
    const snowflakeSymbols = ['❄', '❅', '❆'];
    
    snowflakes.forEach(snowflake => {
        const randomSymbol = snowflakeSymbols[Math.floor(Math.random() * snowflakeSymbols.length)];
        snowflake.textContent = randomSymbol;
    });
}

createSnowflakes();

window.addEventListener('resize', function() {
    const announcement = document.getElementById('announcement');
    if (announcement && announcement.classList.contains('show')) {
        setTimeout(() => {
            announcement.style.transform = 'translateX(-50%) translateY(0) scale(1)';
        }, 100);
    }
});
