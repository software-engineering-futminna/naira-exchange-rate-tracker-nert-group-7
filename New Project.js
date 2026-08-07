//  API SETUP
const API_KEY = '10868b259f8a4b77b6ccb4879ae8bfb4'; 
const BASE_URL = `https://openexchangerates.org/api/latest.json?app_id=${API_KEY}`;

let myChartInstance = null;
let currentLiveRatesGlobal = null;

// Currencies
const TARGET_CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD', 'GHS', 'ZAR', 'AED', 'CNY', 'JPY', 'SAR'];

// Parallel market
const PARALLEL_SPREAD_MULTIPLIERS = {
    USD: 1.035, GBP: 1.037, EUR: 1.034, CAD: 1.030, GHS: 1.025,
    ZAR: 1.020, AED: 1.032, CNY: 1.028, JPY: 1.020, SAR: 1.030
};

//  RATE DATA CALCULATION
async function getNairaExchangeRates() {
    const banner = document.getElementById('systemBanner');
    try {
        const response = await fetch(BASE_URL);
        if (!response.ok) throw new Error(`API request failed: ${response.status}`);

        const data = await response.json();
        const rates = data.rates;
        const usdToNgn = rates['NGN']; 

        if (!usdToNgn) throw new Error("Naira (NGN) data unavailable.");

        const calculatedNgnRates = {};

        TARGET_CURRENCIES.forEach(currency => {
            let officialRate = 0;
            if (currency === 'USD') {
                officialRate = usdToNgn;
            } else if (rates[currency]) {
                officialRate = usdToNgn / rates[currency];
            }

            const parallelRate = officialRate * (PARALLEL_SPREAD_MULTIPLIERS[currency] || 1.03);

            calculatedNgnRates[currency] = {
                official: Number(officialRate.toFixed(2)),
                parallel: Number(parallelRate.toFixed(2))
            };
        });

        localStorage.setItem('cachedNairaRates', JSON.stringify(calculatedNgnRates));
        localStorage.setItem('lastFetchTimestamp', new Date().toISOString());

        if (banner) banner.style.display = 'none';
        return calculatedNgnRates;

    } catch (error) {
        console.error("Error fetching rates, falling back to cached rates:", error.message);
        
        const cachedData = localStorage.getItem('cachedNairaRates');
        const lastFetch = localStorage.getItem('lastFetchTimestamp');

        if (cachedData && banner) {
            const diffMinutes = lastFetch ? Math.round((new Date() - new Date(lastFetch)) / 60000) : 5;
            document.getElementById('lastVerifiedTime').innerText = diffMinutes;
            banner.style.display = 'block';
            return JSON.parse(cachedData);
        }
        return null;
    }
}

// INDICATORS & HIGHLIGHTS
function renderRatesTable(liveRates) {
    const tableBody = document.getElementById('ratesTableBody');
    const liveTimestamp = document.getElementById('liveTimestamp');
    if (!tableBody) return;

    if (liveTimestamp) {
        liveTimestamp.innerText = `Updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    const previousRates = JSON.parse(localStorage.getItem('previousNairaRates')) || {};
    const alertRule = JSON.parse(localStorage.getItem('nairaAlertRule')) || null;

    tableBody.innerHTML = '';

    TARGET_CURRENCIES.forEach(currency => {
        const currentRate = liveRates[currency]?.parallel;
        const previousRate = previousRates[currency]?.parallel;
        
        let indicatorClass = 'rate-stable';
        let indicatorSymbol = '●';

        if (previousRate && currentRate) {
            if (currentRate > previousRate) {
                indicatorClass = 'rate-up';
                indicatorSymbol = '▲';
            } else if (currentRate < previousRate) {
                indicatorClass = 'rate-down';
                indicatorSymbol = '▼';
            }
        }

        // target alert condition is crossed
        let rowClass = "";
        if (alertRule && alertRule.currency === currency && currentRate) {
            if ((alertRule.condition === 'above' && currentRate > alertRule.targetRate) ||
                (alertRule.condition === 'below' && currentRate < alertRule.targetRate)) {
                rowClass = "highlight-alert";
            }
        }

        const row = `
            <tr class="${rowClass}">
                <td><strong>${currency}</strong></td>
                <td>₦${currentRate ? currentRate.toLocaleString() : 'N/A'}</td>
                <td class="${indicatorClass}">${indicatorSymbol}</td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });

    localStorage.setItem('previousNairaRates', JSON.stringify(liveRates));
}

//  FREELANCER CALCULATOR ENGINE
function calculateConversion() {
    const amountInput = document.getElementById('calcAmount');
    const currencySelect = document.getElementById('calcCurrency');
    const resultDisplay = document.getElementById('calcResult');
    const selectedMarket = document.querySelector('input[name="calcMarket"]:checked');

    if (!amountInput || !currencySelect || !resultDisplay || !currentLiveRatesGlobal) return;

    const amount = parseFloat(amountInput.value);
    const currency = currencySelect.value;
    const marketType = selectedMarket ? selectedMarket.value : 'street';

    if (isNaN(amount) || amount <= 0) {
        resultDisplay.innerText = "₦0.00";
        return;
    }

    const rateObj = currentLiveRatesGlobal[currency];
    if (!rateObj) return;

    const rateToUse = marketType === 'official' ? rateObj.official : rateObj.parallel;
    const totalNaira = amount * rateToUse;

    resultDisplay.innerText = `₦${totalNaira.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

//  TARGET RATE ALERT CHECKER & LOCAL STORAGE SAVER
function checkAlertThresholds(liveRates) {
    const savedRuleString = localStorage.getItem('nairaAlertRule');
    if (!savedRuleString) return; 

    const rule = JSON.parse(savedRuleString);
    const currentRateObj = liveRates[rule.currency];

    if (!currentRateObj) return;
    const currentRate = currentRateObj.parallel;

    const lastAlertTime = localStorage.getItem('lastAlertSentTimestamp');
    if (lastAlertTime && (new Date() - new Date(lastAlertTime)) < 3600000) {
        return;
    }

    let triggered = false;
    if (rule.condition === 'above' && currentRate > rule.targetRate) triggered = true;
    if (rule.condition === 'below' && currentRate < rule.targetRate) triggered = true;

    if (triggered) {
        alert(`🚨 TARGET RATE ALERT (${rule.email}):\n${rule.currency} has gone ${rule.condition.toUpperCase()} ₦${rule.targetRate.toLocaleString()}!\n\nCurrent Live Rate: ₦${currentRate.toLocaleString()}`);
        localStorage.setItem('lastAlertSentTimestamp', new Date().toISOString());
    }
}

function saveAlertRule(event) {
    event.preventDefault(); 

    const email = document.getElementById('userEmail')?.value;
    const currency = document.getElementById('currencySelect').value;
    const condition = document.getElementById('conditionSelect').value;
    const targetRate = parseFloat(document.getElementById('thresholdInput').value);
    const statusMessage = document.getElementById('statusMessage');

    if (!email || !email.includes('@')) {
        statusMessage.style.color = "red";
        statusMessage.innerText = "Please provide a valid email address.";
        return;
    }

    if (isNaN(targetRate) || targetRate <= 0) {
        statusMessage.style.color = "red";
        statusMessage.innerText = "Please enter a valid target rate.";
        return;
    }

    const alertRule = { email, currency, condition, targetRate };
    localStorage.setItem('nairaAlertRule', JSON.stringify(alertRule));
    
    statusMessage.style.color = "#22c55e"; 
    statusMessage.innerText = `Alert rule stored! Active when ${currency} goes ${condition} ₦${targetRate.toLocaleString()}`;

    if (currentLiveRatesGlobal) {
        renderRatesTable(currentLiveRatesGlobal);
        checkAlertThresholds(currentLiveRatesGlobal);
    }
}

// HISTORICAL CHART
function saveRateToHistory(liveRates) {
    if (!liveRates || !liveRates['USD']) return [];

    let history = JSON.parse(localStorage.getItem('nairaRateHistory')) || [];
    const timestampString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newLogEntry = {
        time: timestampString,
        USD: liveRates['USD'].parallel,
        GBP: liveRates['GBP'].parallel,
        EUR: liveRates['EUR'].parallel,
        CAD: liveRates['CAD'].parallel
    };

    if (history.length > 0 && history[history.length - 1].USD === newLogEntry.USD) {
        return history; 
    }

    history.push(newLogEntry);
    if (history.length > 7) history.shift(); 

    localStorage.setItem('nairaRateHistory', JSON.stringify(history));
    return history;
}

function renderHistoricalChart(historyData) {
    const ctx = document.getElementById('rateHistoryChart');
    const selectedCurrency = document.getElementById('chartCurrencySelect')?.value || 'USD';
    if (!ctx || !historyData || historyData.length === 0) return;

    const labels = historyData.map(entry => entry.time);
    const chartValues = historyData.map(entry => entry[selectedCurrency] || entry['USD']);

    if (myChartInstance) myChartInstance.destroy();

    myChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `${selectedCurrency} to NGN Rate (₦)`,
                    data: chartValues,
                    borderColor: 'purple',
                    backgroundColor: 'rgba(128, 0, 128, 0.05)',
                    tension: 0.2,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: false } }
        }
    });
}

// 7. NERT'S EXPORT CSV
function exportTableToCSV(liveRates) {
    if (!liveRates) return;

    let csvContent = "data:text/csv;charset=utf-8,Currency,Rate in NGN (₦)\n";

    TARGET_CURRENCIES.forEach(currency => {
        const rate = liveRates[currency]?.parallel || "N/A";
        csvContent += `${currency},${rate}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NERT_Exchange_Rates_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

//  INITIALIZATION
async function initTracker() {
    const liveRates = await getNairaExchangeRates();
    if (!liveRates) return;

    currentLiveRatesGlobal = liveRates;

    renderRatesTable(liveRates);
    calculateConversion();
    checkAlertThresholds(liveRates);
    const historyData = saveRateToHistory(liveRates);
    renderHistoricalChart(historyData);
}

window.addEventListener('DOMContentLoaded', () => {
    initTracker();
    setInterval(initTracker, 300000); // 5 min background update

    // event listeners
    document.getElementById('calcAmount')?.addEventListener('input', calculateConversion);
    document.getElementById('calcCurrency')?.addEventListener('change', calculateConversion);
    document.querySelectorAll('input[name="calcMarket"]').forEach(radio => {
        radio.addEventListener('change', calculateConversion);
    });

    // Form submission listener
    document.getElementById('thresholdForm')?.addEventListener('submit', saveAlertRule);

    // Chart pair selection switch
    document.getElementById('chartCurrencySelect')?.addEventListener('change', () => {
        const historyData = JSON.parse(localStorage.getItem('nairaRateHistory')) || [];
        renderHistoricalChart(historyData);
    });

    // CSV Export listener
    document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
        if (currentLiveRatesGlobal) {
            exportTableToCSV(currentLiveRatesGlobal);
        } else {
            alert("Rates loading. Please try again in a moment.");
        }
    });
});