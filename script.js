// ============================================
// CONFIGURATION
// ============================================
const API_KEY = 'e87207e8f336ea34c5a28e54a6860e80';
const API_BASE = 'https://api.openweathermap.org/data/2.5';

let currentUnit = 'metric'; // 'metric' or 'imperial'
let currentCity = null;
let favorites = JSON.parse(localStorage.getItem('weatherFavorites')) || [];

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {
    cityInput: document.getElementById('cityInput'),
    searchBtn: document.getElementById('searchBtn'),
    locationBtn: document.getElementById('locationBtn'),
    unitToggle: document.getElementById('unitToggle'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    weatherContent: document.getElementById('weatherContent'),
    addFavorite: document.getElementById('addFavorite'),
    favoritesGrid: document.getElementById('favoritesGrid'),
    favorites: document.getElementById('favorites'),
};

// ============================================
// EVENT LISTENERS
// ============================================
elements.searchBtn.addEventListener('click', () => {
    const city = elements.cityInput.value.trim();
    if (city) fetchWeatherByCity(city);
});

elements.cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = elements.cityInput.value.trim();
        if (city) fetchWeatherByCity(city);
    }
});

elements.locationBtn.addEventListener('click', getLocationWeather);

elements.unitToggle.addEventListener('click', toggleUnits);

elements.addFavorite.addEventListener('click', addToFavorites);

// ============================================
// WEATHER ICONS MAPPING
// ============================================
const weatherIcons = {
    '01d': '☀️', '01n': '🌙',
    '02d': '⛅', '02n': '☁️',
    '03d': '☁️', '03n': '☁️',
    '04d': '☁️', '04n': '☁️',
    '09d': '🌧️', '09n': '🌧️',
    '10d': '🌦️', '10n': '🌧️',
    '11d': '⛈️', '11n': '⛈️',
    '13d': '❄️', '13n': '❄️',
    '50d': '🌫️', '50n': '🌫️'
};

// ============================================
// CALCULATE UV INDEX (ESTIMATION)
// ============================================
function calculateUVIndex(lat, clouds, hour) {
    // UV index estimation based on latitude, cloud cover, and time of day
    // This is an approximation when One Call API is not available
    
    const now = new Date();
    const currentHour = hour || now.getHours();
    
    // Base UV based on latitude (higher near equator)
    let baseUV = 11 - Math.abs(lat) / 10;
    
    // Time of day factor (peak at solar noon)
    let timeFactor = 0;
    if (currentHour >= 10 && currentHour <= 14) {
        timeFactor = 1 - Math.abs(12 - currentHour) / 2;
    } else if (currentHour >= 8 && currentHour < 10) {
        timeFactor = (currentHour - 8) / 2;
    } else if (currentHour > 14 && currentHour <= 16) {
        timeFactor = 1 - (currentHour - 14) / 2;
    }
    
    // Cloud cover reduction (more clouds = less UV)
    const cloudFactor = 1 - (clouds / 100) * 0.7;
    
    // Seasonal factor (simplified - higher in summer months for northern hemisphere)
    const month = now.getMonth() + 1;
    let seasonFactor = 1;
    if (lat >= 0) { // Northern hemisphere
        seasonFactor = month >= 5 && month <= 8 ? 1.2 : 0.8;
    } else { // Southern hemisphere
        seasonFactor = month >= 11 || month <= 2 ? 1.2 : 0.8;
    }
    
    const uvIndex = baseUV * timeFactor * cloudFactor * seasonFactor;
    return Math.max(0, Math.min(11, uvIndex)); // Clamp between 0 and 11
}

// ============================================
// FETCH WEATHER BY CITY
// ============================================
async function fetchWeatherByCity(city) {
    showLoading();
    hideError();

    try {
        // Get current weather
        const currentUrl = `${API_BASE}/weather?q=${city}&appid=${API_KEY}&units=${currentUnit}`;
        const currentResponse = await fetch(currentUrl);
        
        if (!currentResponse.ok) {
            throw new Error('City not found');
        }
        
        const currentData = await currentResponse.json();
        currentCity = currentData;

        // Get forecast
        const forecastUrl = `${API_BASE}/forecast?q=${city}&appid=${API_KEY}&units=${currentUnit}`;
        const forecastResponse = await fetch(forecastUrl);
        const forecastData = await forecastResponse.json();

        // Get air quality
        const { lat, lon } = currentData.coord;
        const aqiUrl = `${API_BASE}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
        const aqiResponse = await fetch(aqiUrl);
        const aqiData = await aqiResponse.json();

        displayWeather(currentData, forecastData, aqiData);
    } catch (error) {
        showError(error.message || 'Failed to fetch weather data');
    }
}

// ============================================
// GET LOCATION WEATHER
// ============================================
function getLocationWeather() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        return;
    }

    showLoading();
    hideError();

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                
                // Get current weather by coordinates
                const currentUrl = `${API_BASE}/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=${currentUnit}`;
                const currentResponse = await fetch(currentUrl);
                const currentData = await currentResponse.json();
                currentCity = currentData;

                // Get forecast
                const forecastUrl = `${API_BASE}/forecast?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=${currentUnit}`;
                const forecastResponse = await fetch(forecastUrl);
                const forecastData = await forecastResponse.json();

                // Get air quality
                const aqiUrl = `${API_BASE}/air_pollution?lat=${latitude}&lon=${longitude}&appid=${API_KEY}`;
                const aqiResponse = await fetch(aqiUrl);
                const aqiData = await aqiResponse.json();

                displayWeather(currentData, forecastData, aqiData);
            } catch (error) {
                showError('Failed to fetch weather data for your location');
            }
        },
        () => {
            showError('Unable to retrieve your location');
        }
    );
}

// ============================================
// DISPLAY WEATHER
// ============================================
function displayWeather(current, forecast, aqi) {
    hideLoading();
    elements.weatherContent.style.display = 'block';

    // Current weather
    const tempUnit = currentUnit === 'metric' ? '°C' : '°F';
    const windUnit = currentUnit === 'metric' ? 'm/s' : 'mph';
    
    document.getElementById('locationName').textContent = `${current.name}, ${current.sys.country}`;
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    document.getElementById('mainTemp').textContent = Math.round(current.main.temp) + tempUnit;
    document.getElementById('weatherIcon').textContent = weatherIcons[current.weather[0].icon] || '🌡️';
    document.getElementById('weatherDesc').textContent = current.weather[0].description.toUpperCase();
    document.getElementById('feelsLike').textContent = Math.round(current.main.feels_like) + tempUnit;
    document.getElementById('humidity').textContent = current.main.humidity + '%';
    document.getElementById('windSpeed').textContent = Math.round(current.wind.speed) + ' ' + windUnit;
    document.getElementById('pressure').textContent = current.main.pressure + ' hPa';
    document.getElementById('visibility').textContent = (current.visibility / 1000).toFixed(1) + ' km';
    document.getElementById('clouds').textContent = current.clouds.all + '%';

    // Sunrise & Sunset
    document.getElementById('sunrise').textContent = new Date(current.sys.sunrise * 1000).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    document.getElementById('sunset').textContent = new Date(current.sys.sunset * 1000).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    // UV Index - Calculate estimation
    const uvi = calculateUVIndex(current.coord.lat, current.clouds.all);
    document.getElementById('uvValue').textContent = uvi.toFixed(1);
    
    let uvLevel = 'LOW';
    let uvColor = '#00FF00';
    if (uvi >= 11) {
        uvLevel = 'EXTREME';
        uvColor = '#8B008B';
    } else if (uvi >= 8) {
        uvLevel = 'VERY HIGH';
        uvColor = '#FF0000';
    } else if (uvi >= 6) {
        uvLevel = 'HIGH';
        uvColor = '#FF9900';
    } else if (uvi >= 3) {
        uvLevel = 'MODERATE';
        uvColor = '#FFFF00';
    }
    
    document.getElementById('uvLevel').textContent = uvLevel;
    const uvIndicator = document.getElementById('uvIndicator');
    uvIndicator.style.left = `${Math.min(uvi * 9, 100)}%`;

    // Hourly forecast (next 24 hours from 5-day forecast)
    const hourlyContainer = document.getElementById('hourlyForecast');
    hourlyContainer.innerHTML = '';
    
    forecast.list.slice(0, 8).forEach(item => {
        const hourDiv = document.createElement('div');
        hourDiv.className = 'hour-item';
        
        const time = new Date(item.dt * 1000);
        hourDiv.innerHTML = `
            <div class="hour-time">${time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
            <div class="hour-icon">${weatherIcons[item.weather[0].icon] || '🌡️'}</div>
            <div class="hour-temp">${Math.round(item.main.temp)}${tempUnit}</div>
            <div style="font-size: 0.8rem; margin-top: 0.5rem;">${item.pop ? Math.round(item.pop * 100) + '%' : '0%'}</div>
        `;
        hourlyContainer.appendChild(hourDiv);
    });

    // 5-day forecast
    const forecastGrid = document.getElementById('forecastGrid');
    forecastGrid.innerHTML = '';
    
    const dailyForecasts = {};
    forecast.list.forEach(item => {
        const date = new Date(item.dt * 1000).toLocaleDateString();
        if (!dailyForecasts[date]) {
            dailyForecasts[date] = {
                temps: [],
                weather: item.weather[0],
                date: new Date(item.dt * 1000)
            };
        }
        dailyForecasts[date].temps.push(item.main.temp);
    });

    Object.values(dailyForecasts).slice(0, 5).forEach(day => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'forecast-day';
        
        const maxTemp = Math.round(Math.max(...day.temps));
        const minTemp = Math.round(Math.min(...day.temps));
        
        dayDiv.innerHTML = `
            <div class="day-name">${day.date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <div style="font-size: 0.9rem; color: var(--gray-4);">${day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            <div class="day-icon">${weatherIcons[day.weather.icon] || '🌡️'}</div>
            <div style="text-align: center; margin: 0.5rem 0; text-transform: uppercase; font-size: 0.9rem;">${day.weather.description}</div>
            <div class="day-temps">
                <div class="temp-high">${maxTemp}${tempUnit}</div>
                <div class="temp-low">${minTemp}${tempUnit}</div>
            </div>
        `;
        forecastGrid.appendChild(dayDiv);
    });

    // Air Quality Index
    if (aqi && aqi.list && aqi.list.length > 0) {
        const aqiValue = aqi.list[0].main.aqi;
        const components = aqi.list[0].components;
        
        document.getElementById('aqiValue').textContent = aqiValue;
        
        const aqiLevels = {
            1: { text: 'GOOD', class: 'aqi-good', desc: 'Air quality is satisfactory' },
            2: { text: 'FAIR', class: 'aqi-moderate', desc: 'Acceptable air quality' },
            3: { text: 'MODERATE', class: 'aqi-moderate', desc: 'Sensitive groups may experience issues' },
            4: { text: 'POOR', class: 'aqi-unhealthy', desc: 'Everyone may begin to experience health effects' },
            5: { text: 'VERY POOR', class: 'aqi-very-unhealthy', desc: 'Health alert: everyone may experience serious effects' }
        };
        
        const level = aqiLevels[aqiValue] || aqiLevels[1];
        const aqiLevelEl = document.getElementById('aqiLevel');
        aqiLevelEl.textContent = level.text;
        aqiLevelEl.className = `aqi-indicator ${level.class}`;
        document.getElementById('aqiDesc').textContent = level.desc;
    }

    updateFavoritesDisplay();
}

// ============================================
// FAVORITES MANAGEMENT
// ============================================
function addToFavorites() {
    if (!currentCity) return;
    
    const favorite = {
        name: currentCity.name,
        country: currentCity.sys.country,
        id: currentCity.id
    };
    
    if (!favorites.some(f => f.id === favorite.id)) {
        favorites.push(favorite);
        localStorage.setItem('weatherFavorites', JSON.stringify(favorites));
        updateFavoritesDisplay();
    }
}

function updateFavoritesDisplay() {
    const grid = elements.favoritesGrid;
    grid.innerHTML = '';
    
    if (favorites.length > 0) {
        elements.favorites.style.display = 'block';
        
        favorites.forEach((fav, index) => {
            const favDiv = document.createElement('div');
            favDiv.className = 'favorite-item';
            favDiv.innerHTML = `
                <button class="favorite-remove" data-index="${index}">×</button>
                <div style="font-weight: 700;">${fav.name}</div>
                <div style="font-size: 0.8rem; color: var(--gray-4);">${fav.country}</div>
            `;
            favDiv.addEventListener('click', (e) => {
                if (!e.target.classList.contains('favorite-remove')) {
                    fetchWeatherByCity(fav.name);
                }
            });
            grid.appendChild(favDiv);
        });
        
        // Add remove listeners
        document.querySelectorAll('.favorite-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                favorites.splice(index, 1);
                localStorage.setItem('weatherFavorites', JSON.stringify(favorites));
                updateFavoritesDisplay();
            });
        });
    } else {
        elements.favorites.style.display = 'none';
    }
}

// ============================================
// TOGGLE UNITS
// ============================================
function toggleUnits() {
    currentUnit = currentUnit === 'metric' ? 'imperial' : 'metric';
    if (currentCity) {
        fetchWeatherByCity(currentCity.name);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showLoading() {
    elements.loading.style.display = 'block';
    elements.weatherContent.style.display = 'none';
}

function hideLoading() {
    elements.loading.style.display = 'none';
}

function showError(message) {
    elements.error.textContent = `⚠️ ERROR: ${message.toUpperCase()}`;
    elements.error.style.display = 'block';
    hideLoading();
}

function hideError() {
    elements.error.style.display = 'none';
}

// ============================================
// INITIALIZATION
// ============================================
updateFavoritesDisplay();

// Load default city
const defaultCity = 'London';
fetchWeatherByCity(defaultCity);
