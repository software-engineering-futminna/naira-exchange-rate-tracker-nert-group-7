// Replace this with your actual API key from openexchangerates.org
const API_KEY = '0868b259f8a4b77b6ccb4879ae8bfb4'; 
const API_URL = `https://openexchangerates.org/api/latest.json?app_id=${API_KEY}`;

async function fetchNairaRates() {
    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 1. Extract raw rates (relative to 1 USD)
        const usdToNgn = data.rates.NGN;
        const usdToGbp = data.rates.GBP;
        const usdToEur = data.rates.EUR;
        
        // 2. Calculate cross-rates so everything is in terms of Naira (NGN)
        // Formula: 1 unit of foreign currency = (1 / usdToForeign) * usdToNgn
        const ratesInNaira = {
            USD: usdToNgn,                     // How many Naira for 1 USD
            GBP: (1 / usdToGbp) * usdToNgn,   // How many Naira for 1 GBP
            EUR: (1 / usdToEur) * usdToNgn,   // How many Naira for 1 EUR
            timestamp: data.timestamp * 1000  // Convert Unix timestamp to milliseconds
        };

        console.log("Processed Naira Rates:", ratesInNaira);
        return ratesInNaira;

    } catch (error) {
        console.error("Failed to fetch exchange rates:", error);
        return null;
    }
}

// Example usage:
// fetchNairaRates().then(rates => { if(rates) console.log(`1 USD = ₦${rates.USD.toFixed(2)}`) });


function saveRateToHistory(newRates) {
    // 1. Get existing history or initialize an empty array if it's the first time
    let history = JSON.parse(localStorage.getItem('naira_rate_history')) || [];

    // 2. Format the data point for your chart
    const dataPoint = {
        date: new Date(newRates.timestamp).toLocaleDateString(), // e.g., "6/23/2026"
        USD: Number(newRates.USD.toFixed(2)),
        GBP: Number(newRates.GBP.toFixed(2)),
        EUR: Number(newRates.EUR.toFixed(2))
    };

    // 3. Avoid duplicate entries for the same day (optional but clean)
    const alreadyExists = history.some(item => item.date === dataPoint.date);
    if (!alreadyExists) {
        history.push(dataPoint);
        // Keep only the last 7 or 30 entries so localStorage doesn't get bloated
        if (history.length > 30) history.shift(); 
        
        localStorage.setItem('naira_rate_history', JSON.stringify(history));
        console.log("History updated successfully!");
    }
}


// Example of how a user alert profile might look in localStorage
// localStorage.setItem('user_alert', JSON.stringify({ currency: 'USD', condition: 'above', threshold: 1500 }));

function checkAlertThresholds(currentRates) {
    const savedAlert = JSON.parse(localStorage.getItem('user_alert'));
    
    if (!savedAlert) return; // No alert set by the user yet

    const { currency, condition, threshold } = savedAlert;
    const currentRate = currentRates[currency];

    if (condition === 'above' && currentRate > threshold) {
        triggerVisualAlert(currency, currentRate, 'above', threshold);
    } else if (condition === 'below' && currentRate < threshold) {
        triggerVisualAlert(currency, currentRate, 'below', threshold);
    }
}

function triggerVisualAlert(currency, currentRate, condition, threshold) {
    // For now, a simple browser alert. You can turn this into a beautiful UI notification later!
    alert(`🚨 ALERT: 1 ${currency} is now ₦${currentRate.toFixed(2)}, which is ${condition} your threshold of ₦${threshold}!`);
}

async function initApp() {
    console.log("Fetching latest rates...");
    const latestRates = await fetchNairaRates();
    
    if (latestRates) {
        // 1. Save to history for your future line chart
        saveRateToHistory(latestRates);
        
        // 2. Immediately check if the business owner's thresholds were crossed
        checkAlertThresholds(latestRates);
        
        // 3. (Next phase) Update your UI elements here!
    }
}

// Run the app on page load
initApp();

