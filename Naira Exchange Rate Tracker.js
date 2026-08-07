
const API_KEY = '0868b259f8a4b77b6ccb4879ae8bfb4'; 
const API_URL = `https://openexchangerates.org/api/latest.json?app_id=${API_KEY}`;

async function fetchNairaRates() {
    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        //   raw rates
        const usdToNgn = data.rates.NGN;
        const usdToGbp = data.rates.GBP;
        const usdToEur = data.rates.EUR;
        
        // Naira Calculations (NGN)
        // 1 unit of foreign currency = (1 / usdToForeign) * usdToNgn
        const ratesInNaira = {
            USD: usdToNgn,                     // How many Naira for 1 USD
            GBP: (1 / usdToGbp) * usdToNgn,   
            EUR: (1 / usdToEur) * usdToNgn,   
            timestamp: data.timestamp * 1000  
        };

        console.log("Processed Naira Rates:", ratesInNaira);
        return ratesInNaira;

    } catch (error) {
        console.error("Failed to fetch exchange rates:", error);
        return null;
    }
}




function saveRateToHistory(newRates) {
    //  Get existing history
    let history = JSON.parse(localStorage.getItem('naira_rate_history')) || [];

    //   data point
    const dataPoint = {
        date: new Date(newRates.timestamp).toLocaleDateString(), 
        USD: Number(newRates.USD.toFixed(2)),
        GBP: Number(newRates.GBP.toFixed(2)),
        EUR: Number(newRates.EUR.toFixed(2))
    };

    //  Avoid duplicate entries 
    const alreadyExists = history.some(item => item.date === dataPoint.date);
    if (!alreadyExists) {
        history.push(dataPoint);
        // the last 7 or 30 entries 
        if (history.length > 30) history.shift(); 
        
        localStorage.setItem('naira_rate_history', JSON.stringify(history));
        console.log("History updated successfully!");
    }
}



// localStorage

function checkAlertThresholds(currentRates) {
    const savedAlert = JSON.parse(localStorage.getItem('user_alert'));
    
    if (!savedAlert) return; 

    const { currency, condition, threshold } = savedAlert;
    const currentRate = currentRates[currency];

    if (condition === 'above' && currentRate > threshold) {
        triggerVisualAlert(currency, currentRate, 'above', threshold);
    } else if (condition === 'below' && currentRate < threshold) {
        triggerVisualAlert(currency, currentRate, 'below', threshold);
    }
}

function triggerVisualAlert(currency, currentRate, condition, threshold) {
    // A simple browser alert.
    alert(`🚨 ALERT: 1 ${currency} is now ₦${currentRate.toFixed(2)}, which is ${condition} your threshold of ₦${threshold}!`);
}

async function initApp() {
    console.log("Fetching latest rates...");
    const latestRates = await fetchNairaRates();
    
    if (latestRates) {
        // 1. latest charts
        saveRateToHistory(latestRates);
        
        //  NERT'S owner's thresholds crossed
        checkAlertThresholds(latestRates);
        
    
    }
}

//  app(NERT) on page load
initApp();

