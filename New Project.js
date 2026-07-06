// 1. CONFIGURATION & API SETUP
const API_KEY = '10868b259f8a4b77b6ccb4879ae8bfb4'; 
const BASE_URL = `https://openexchangerates.org/api/latest.json?app_id=${API_KEY}`;

// 2. FETCH AND LIVE RATE DATA CALCULATION
async function getNairaExchangeRates() {
    try {
        const response = await fetch(BASE_URL);
        if (!response.ok) throw new Error(`API request failed with status: ${response.status}`);

        const data = await response.json();
        const rates = data.rates;
        const usdToNgn = rates['NGN']; 

        if (!usdToNgn) throw new Error("Naira (NGN) data is currently unavailable.");

        const targetCurrencies = ['USD', 'GBP', 'EUR'];
        const calculatedNgnRates = {};

        targetCurrencies.forEach(currency => {
            if (currency === 'USD') {
                calculatedNgnRates['USD'] = Number(usdToNgn.toFixed(2));
            } else if (rates[currency]) {
                const rateInNgn = usdToNgn / rates[currency];
                calculatedNgnRates[currency] = Number(rateInNgn.toFixed(2));
            } else {
                calculatedNgnRates[currency] = null;
            }
        });

        console.log("Calculated Live Rates:", calculatedNgnRates);
        return calculatedNgnRates;
    } catch (error) {
        console.error("Error fetching or parsing exchange rates:", error.message);
        return null;
    }
}

// 3. ALERT THRESHOLD EVALUATION (TRIGGER LOGIC)
function checkAlertThresholds(liveRates) {
    const savedRuleString = localStorage.getItem('nairaAlertRule');
    if (!savedRuleString) return; 

    const rule = JSON.parse(savedRuleString);
    const currentLiveRate = liveRates[rule.currency];

    if (!currentLiveRate) return;

    if (rule.condition === 'above' && currentLiveRate > rule.targetRate) {
        alert(`🚨 RATE ALERT: ${rule.currency} has gone ABOVE your threshold! \n\nTarget: ₦${rule.targetRate}\nCurrent Live Rate: ₦${currentLiveRate}`);
        localStorage.removeItem('nairaAlertRule'); 
        document.getElementById('statusMessage').innerText = ""; 
    } else if (rule.condition === 'below' && currentLiveRate < rule.targetRate) {
        alert(`🚨 RATE ALERT: ${rule.currency} has gone BELOW your threshold! \n\nTarget: ₦${rule.targetRate}\nCurrent Live Rate: ₦${currentLiveRate}`);
        localStorage.removeItem('nairaAlertRule'); 
        document.getElementById('statusMessage').innerText = "";
    }
}

// 4. SAVE USER RULES FROM THE FORM
function saveAlertRule(event) {
    event.preventDefault(); 

    const currency = document.getElementById('currencySelect').value;
    const condition = document.getElementById('conditionSelect').value;
    const targetRate = parseFloat(document.getElementById('thresholdInput').value);
    const statusMessage = document.getElementById('statusMessage');

    if (!targetRate || targetRate <= 0) {
        statusMessage.style.color = "red";
        statusMessage.innerText = "Please enter a valid target rate.";
        return;
    }

    const alertRule = { currency, condition, targetRate };
    localStorage.setItem('nairaAlertRule', JSON.stringify(alertRule));
    
    statusMessage.style.color = "#22c55e"; 
    statusMessage.innerText = `Success! Alert set for when ${currency} goes ${condition} ₦${targetRate}`;
}

// 5. HISTORICAL DATA STORAGE & CHART RENDER
function saveRateToHistory(liveRates) {
    if (!liveRates || !liveRates['USD']) return [];

    let history = JSON.parse(localStorage.getItem('nairaRateHistory')) || [];
    const now = new Date();
    const timestampString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newLogEntry = {
        time: timestampString,
        USD: liveRates['USD'],
        GBP: liveRates['GBP'],
        EUR: liveRates['EUR']
    };

    // Prevent immediate duplicate clutter on quick test page refreshes
    if (history.length > 0 && history[history.length - 1].USD === liveRates['USD'] && history.length >= 5) {
        return history; 
    }

    history.push(newLogEntry);
    if (history.length > 7) history.shift(); // Keep last 7 measurements 

    localStorage.setItem('nairaRateHistory', JSON.stringify(history));
    return history;
}

function renderHistoricalChart(historyData) {
    const ctx = document.getElementById('rateHistoryChart');
    if (!ctx || !historyData || historyData.length === 0) return;

    const labels = historyData.map(entry => entry.time);
    const usdData = historyData.map(entry => entry.USD);
    const gbpData = historyData.map(entry => entry.GBP);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'USD to NGN',
                    data: usdData,
                    borderColor: '#0051cb',
                    backgroundColor: 'rgba(0, 81, 203, 0.05)',
                    tension: 0.2,
                    fill: true
                },
                {
                    label: 'GBP to NGN',
                    data: gbpData,
                    borderColor: 'purple',
                    backgroundColor: 'rgba(128, 0, 128, 0.05)',
                    tension: 0.2,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: false }
            }
        }
    });
}

// 6. INITIALIZATION PIPELINE (The Connective Tissue)
async function initTracker() {
    const statusMessage = document.getElementById('statusMessage');
    const liveRates = await getNairaExchangeRates();
    
    if (!liveRates) {
        if (statusMessage) {
            statusMessage.style.color = "red";
            statusMessage.innerText = "Failed to load live rates. Check your API key.";
        }
        return;
    }

    // 1. Evaluate alert limits
    checkAlertThresholds(liveRates);

    // 2. Log data array to internal memory
    const historyData = saveRateToHistory(liveRates);

    // 3. Render the interactive line chart
    renderHistoricalChart(historyData);
}

window.addEventListener('DOMContentLoaded', () => {
    initTracker();
    
    const form = document.getElementById('thresholdForm');
    if (form) {
        form.addEventListener('submit', saveAlertRule);
    }
});