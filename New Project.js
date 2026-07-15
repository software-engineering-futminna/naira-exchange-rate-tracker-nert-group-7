// 1. CONFIGURATION & API SETUP
const API_KEY = '10868b259f8a4b77b6ccb4879ae8bfb4'; 
const BASE_URL = `https://openexchangerates.org/api/latest.json?app_id=${API_KEY}`;

let myChartInstance = null;

// Target 10 currencies as specified in SWEMLAB guidelines
const TARGET_CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD', 'GHS', 'ZAR', 'AED', 'CNY', 'JPY', 'SAR'];

// 2. FETCH AND RATE DATA CALCULATION
async function getNairaExchangeRates() {
    try {
        const response = await fetch(BASE_URL);
        if (!response.ok) throw new Error(`API request failed: ${response.status}`);

        const data = await response.json();
        const rates = data.rates;
        const usdToNgn = rates['NGN']; 

        if (!usdToNgn) throw new Error("Naira (NGN) data is currently unavailable.");

        const calculatedNgnRates = {};

        TARGET_CURRENCIES.forEach(currency => {
            if (currency === 'USD') {
                calculatedNgnRates['USD'] = Number(usdToNgn.toFixed(2));
            } else if (rates[currency]) {
                const rateInNgn = usdToNgn / rates[currency];
                calculatedNgnRates[currency] = Number(rateInNgn.toFixed(2));
            } else {
                calculatedNgnRates[currency] = null;
            }
        });

        return calculatedNgnRates;
    } catch (error) {
        console.error("Error fetching rates:", error.message);
        return null;
    }
}

// 3. RENDER TABLE WITH COLOUR-CODED INDICATORS
function renderRatesTable(liveRates) {
    const tableBody = document.getElementById('ratesTableBody');
    if (!tableBody) return;

    // Retrieve previous rates from localStorage to compare changes
    const cachedRates = JSON.parse(localStorage.getItem('previousNairaRates')) || {};
    tableBody.innerHTML = '';

    TARGET_CURRENCIES.forEach(currency => {
        const currentRate = liveRates[currency];
        const previousRate = cachedRates[currency];
        
        let indicatorClass = 'rate-stable';
        let indicatorSymbol = '●'; // Stable

        if (previousRate && currentRate) {
            if (currentRate > previousRate) {
                indicatorClass = 'rate-up';
                indicatorSymbol = '▲';
            } else if (currentRate < previousRate) {
                indicatorClass = 'rate-down';
                indicatorSymbol = '▼';
            }
        }

        const row = `
            <tr>
                <td><strong>${currency}</strong></td>
                <td>₦${currentRate ? currentRate.toLocaleString() : 'N/A'}</td>
                <td class="${indicatorClass}">${indicatorSymbol}</td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });

    // Cache the current rates as the new "previous" benchmark for the next visit
    localStorage.setItem('previousNairaRates', JSON.stringify(liveRates));
}

// 4. EXPORT TO CSV LOGIC
function exportTableToCSV(liveRates) {
    if (!liveRates) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Currency,Rate in NGN (₦)\n"; // Headers

    TARGET_CURRENCIES.forEach(currency => {
        csvContent += `${currency},${liveRates[currency]}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NERT_Exchange_Rates_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 5. ALERT THRESHOLD EVALUATION
function checkAlertThresholds(liveRates) {
    const savedRuleString = localStorage.getItem('nairaAlertRule');
    if (!savedRuleString) return; 

    const rule = JSON.parse(savedRuleString);
    const currentLiveRate = liveRates[rule.currency];

    if (!currentLiveRate) return;

    if (rule.condition === 'above' && currentLiveRate > rule.targetRate) {
        alert(`🚨 RATE ALERT: ${rule.currency} has gone ABOVE your threshold! \n\nTarget: ₦${rule.targetRate.toLocaleString()}\nCurrent Live Rate: ₦${currentLiveRate.toLocaleString()}`);
        localStorage.removeItem('nairaAlertRule'); 
        document.getElementById('statusMessage').innerText = ""; 
    } else if (rule.condition === 'below' && currentLiveRate < rule.targetRate) {
        alert(`🚨 RATE ALERT: ${rule.currency} has gone BELOW your threshold! \n\nTarget: ₦${rule.targetRate.toLocaleString()}\nCurrent Live Rate: ₦${currentLiveRate.toLocaleString()}`);
        localStorage.removeItem('nairaAlertRule'); 
        document.getElementById('statusMessage').innerText = "";
    }
}

// 6. SAVE ALERT RULE
function saveAlertRule(event) {
    event.preventDefault(); 

    const currency = document.getElementById('currencySelect').value;
    const condition = document.getElementById('conditionSelect').value;
    const targetRate = parseFloat(document.getElementById('thresholdInput').value);
    const statusMessage = document.getElementById('statusMessage');

    if (isNaN(targetRate) || targetRate <= 0) {
        statusMessage.style.color = "red";
        statusMessage.innerText = "Please enter a valid target rate.";
        return;
    }

    const alertRule = { currency, condition, targetRate };
    localStorage.setItem('nairaAlertRule', JSON.stringify(alertRule));
    
    statusMessage.style.color = "#22c55e"; 
    statusMessage.innerText = `Success! Alert set for when ${currency} goes ${condition === 'above' ? 'above' : 'below'} ₦${targetRate.toLocaleString()}`;

    getNairaExchangeRates().then(rates => {
        if (rates) checkAlertThresholds(rates);
    });
}

// 7. HISTORICAL DATA STORAGE & CHART RENDER
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

    if (history.length > 0 && history[history.length - 1].USD === liveRates['USD']) {
        return history; 
    }

    history.push(newLogEntry);
    if (history.length > 7) history.shift(); 

    localStorage.setItem('nairaRateHistory', JSON.stringify(history));
    return history;
}

function renderHistoricalChart(historyData) {
    const ctx = document.getElementById('rateHistoryChart');
    if (!ctx || !historyData || historyData.length === 0) return;

    const labels = historyData.map(entry => entry.time);
    const usdData = historyData.map(entry => entry.USD);
    const gbpData = historyData.map(entry => entry.GBP);

    if (myChartInstance) {
        myChartInstance.destroy();
    }

    myChartInstance = new Chart(ctx, {
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

// 8. INITIALIZATION PIPELINE
let currentLiveRatesGlobal = null;

async function initTracker() {
    const statusMessage = document.getElementById('statusMessage');
    const liveRates = await getNairaExchangeRates();
    
    if (!liveRates) {
        if (statusMessage) {
            statusMessage.style.color = "red";
            statusMessage.innerText = "Failed to load live rates. Check API key.";
        }
        return;
    }

    currentLiveRatesGlobal = liveRates;

    renderRatesTable(liveRates);
    checkAlertThresholds(liveRates);
    const historyData = saveRateToHistory(liveRates);
    renderHistoricalChart(historyData);
}

window.addEventListener('DOMContentLoaded', () => {
    initTracker();
    setInterval(initTracker, 300000); // 5 min background update
    
    const form = document.getElementById('thresholdForm');
    if (form) {
        form.addEventListener('submit', saveAlertRule);
    }

    const csvBtn = document.getElementById('exportCsvBtn');
    if (csvBtn) {
        csvBtn.addEventListener('click', () => {
            if (currentLiveRatesGlobal) {
                exportTableToCSV(currentLiveRatesGlobal);
            } else {
                alert("Rates are still loading. Please try again in a moment.");
            }
        });
    }
});