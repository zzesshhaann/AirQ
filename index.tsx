
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import { GoogleGenAI } from "@google/genai";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- Expanded Mock Data with Worldwide Cities ---
const initialAqiData = [
    // Pakistan
    { city: "Karachi", lat: 24.8607, lon: 67.0011, aqi: 185 },
    { city: "Lahore", lat: 31.5820, lon: 74.3294, aqi: 250 },
    { city: "Faisalabad", lat: 31.4180, lon: 73.0790, aqi: 165 },
    { city: "Islamabad", lat: 33.6844, lon: 73.0479, aqi: 110 },
    { city: "Rawalpindi", lat: 33.5651, lon: 73.0169, aqi: 120 },
    { city: "Peshawar", lat: 34.0151, lon: 71.5249, aqi: 175 },
    { city: "Multan", lat: 30.1575, lon: 71.5249, aqi: 190 },
    { city: "Gujranwala", lat: 32.1623, lon: 74.1883, aqi: 210 },
    { city: "Quetta", lat: 30.1798, lon: 66.9750, aqi: 130 },
    { city: "Hyderabad", lat: 25.3969, lon: 68.3737, aqi: 155 },
    { city: "Sialkot", lat: 32.4945, lon: 74.5229, aqi: 180 },
    { city: "Bahawalpur", lat: 29.3956, lon: 71.6836, aqi: 170 },
    // Asia
    { city: "Delhi", lat: 28.7041, lon: 77.1025, aqi: 320 },
    { city: "Beijing", lat: 39.9042, lon: 116.4074, aqi: 155 },
    { city: "Tokyo", lat: 35.6762, lon: 139.6503, aqi: 45 },
    { city: "Jakarta", lat: -6.2088, lon: 106.8456, aqi: 140 },
    // Europe
    { city: "London", lat: 51.5072, lon: -0.1276, aqi: 75 },
    { city: "Paris", lat: 48.8566, lon: 2.3522, aqi: 80 },
    { city: "Moscow", lat: 55.7558, lon: 37.6173, aqi: 60 },
    // Americas
    { city: "New York", lat: 40.7128, lon: -74.0060, aqi: 55 },
    { city: "Los Angeles", lat: 34.0522, lon: -118.2437, aqi: 125 },
    { city: "Mexico City", lat: 19.4326, lon: -99.1332, aqi: 160 },
    { city: "São Paulo", lat: -23.5505, lon: -46.6333, aqi: 95 },
    // Africa & Middle East
    { city: "Cairo", lat: 30.0444, lon: 31.2357, aqi: 180 },
    { city: "Lagos", lat: 6.5244, lon: 3.3792, aqi: 195 },
    { city: "Dubai", lat: 25.276987, lon: 55.296249, aqi: 135 },
];

const HISTORICAL_DATA_KEY = 'historicalAqiData';

// --- Generate and Retrieve Historical Data ---
const generateHistoricalData = (baseAqi) => {
    const data = [];
    for (let i = 90; i >= 0; i--) { // Generate 90 days of data
        const date = new Date();
        date.setDate(date.getDate() - i);
        const aqi = baseAqi + Math.floor(Math.random() * 41) - 20; // Fluctuation of +/- 20
        data.push({ date: date.toISOString().split('T')[0], aqi: Math.max(0, aqi) });
    }
    return data;
};

const initializeHistoricalData = () => {
    if (!localStorage.getItem(HISTORICAL_DATA_KEY)) {
        const allHistoricalData = {};
        initialAqiData.forEach(city => {
            allHistoricalData[city.city] = generateHistoricalData(city.aqi);
        });
        localStorage.setItem(HISTORICAL_DATA_KEY, JSON.stringify(allHistoricalData));
    }
};

const getHistoricalDataForCity = (cityName) => {
    const allData = JSON.parse(localStorage.getItem(HISTORICAL_DATA_KEY) || '{}');
    return allData[cityName] || [];
};

// --- Mock Geocoding Service ---
const geocodeCity = (cityName, data) => {
    const cityData = data.find(
        city => city.city.toLowerCase() === cityName.toLowerCase().trim()
    );
    return cityData ? { lat: cityData.lat, lon: cityData.lon } : null;
};

// --- AQI Classification (Simulating ML Model) ---
const getAqiInfo = (aqi) => {
    if (aqi <= 50) return { classification: "Good", color: "#00e400", darkColor: "#00b300" };
    if (aqi <= 100) return { classification: "Moderate", color: "#ffff00", darkColor: "#cccc00" };
    if (aqi <= 150) return { classification: "Unhealthy for Sensitive Groups", color: "#ff7e00", darkColor: "#cc6500" };
    if (aqi <= 200) return { classification: "Unhealthy", color: "#ff0000", darkColor: "#cc0000" };
    if (aqi <= 300) return { classification: "Very Unhealthy", color: "#8f3f97", darkColor: "#723279" };
    return { classification: "Hazardous", color: "#7e0023", darkColor: "#65001c" };
};

const App = () => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markersLayer = useRef(null);
    const [aqiData, setAqiData] = useState(initialAqiData);

    // Effect for initializing map and historical data
    useEffect(() => {
        initializeHistoricalData();
        if (map.current) return;
        
        map.current = L.map(mapContainer.current, { center: [20, 20], zoom: 2, zoomControl: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(map.current);

        markersLayer.current = L.layerGroup().addTo(map.current);

        const animationStyleSheet = document.createElement('style');
        document.head.appendChild(animationStyleSheet);
        const aqiLevelsForAnimation = [0, 51, 101, 151, 201, 301];
        let animationStyles = '';
        aqiLevelsForAnimation.forEach(aqi => {
            const info = getAqiInfo(aqi);
            const animationName = `pulse-${info.classification.replace(/\s+/g, '-').toLowerCase()}`;
            animationStyles += `@keyframes ${animationName} { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 ${info.color}99; } 70% { transform: scale(1); box-shadow: 0 0 10px 10px ${info.color}00; } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 ${info.color}00; } }`;
        });
        animationStyleSheet.innerHTML = animationStyles;

        return () => {
            if (map.current) { map.current.remove(); map.current = null; }
            if (animationStyleSheet) { document.head.removeChild(animationStyleSheet); }
        };
    }, []);

    // Effect for updating markers when AQI data changes
    useEffect(() => {
        if (!markersLayer.current) return;
        markersLayer.current.clearLayers();

        aqiData.forEach(data => {
            const aqiInfo = getAqiInfo(data.aqi);
            const animationName = `pulse-${aqiInfo.classification.replace(/\s+/g, '-').toLowerCase()}`;
            const iconHtml = `<div style="background-color: ${aqiInfo.color}; width: 18px; height: 18px; border-radius: 50%; border: 2px solid ${aqiInfo.darkColor}; animation: ${animationName} 2s infinite;"></div>`;
            const customIcon = L.divIcon({ html: iconHtml, className: 'marker-container', iconSize: [22, 22], iconAnchor: [11, 11] });
            
            const popupNode = document.createElement('div');
            const popupRoot = createRoot(popupNode);
            popupRoot.render(<PopupContent data={data} aqiInfo={aqiInfo} />);
            
            L.marker([data.lat, data.lon], { icon: customIcon }).addTo(markersLayer.current).bindPopup(popupNode);
        });
    }, [aqiData]);

    // Effect for simulating real-time data updates
    useEffect(() => {
        const interval = setInterval(() => {
            setAqiData(prevData =>
                prevData.map(city => {
                    const change = Math.floor(Math.random() * 11) - 5; // Fluctuation of +/- 5
                    return { ...city, aqi: Math.max(0, city.aqi + change) };
                })
            );
        }, 300000); // 5 minutes

        return () => clearInterval(interval);
    }, []);

    const handleSearch = (coords) => map.current?.flyTo([coords.lat, coords.lon], 10);
    const focusOnPakistan = () => map.current?.flyTo([30.3753, 69.3451], 6);
    const resetToWorldwide = () => map.current?.flyTo([20, 20], 2);

    return (
        <>
            <Header onSearch={handleSearch} onFocusPakistan={focusOnPakistan} onResetWorldwide={resetToWorldwide} aqiData={aqiData} />
            <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
            <Legend />
        </>
    );
};

const Header = ({ onSearch, onFocusPakistan, onResetWorldwide, aqiData }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!searchTerm) return;
        const coords = geocodeCity(searchTerm, aqiData);
        if (coords) { onSearch(coords); } 
        else { alert(`City "${searchTerm}" not found.`); }
        setSearchTerm('');
    };

    const buttonStyle = { background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--glass-border)', color: 'var(--text-color)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', transition: 'background 0.2s' };
    
    return (
        <div id="app-header" style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', background: 'var(--glass-background)', backdropFilter: 'blur(10px) saturate(180%)', WebkitBackdropFilter: 'blur(10px) saturate(180%)', borderRadius: '12px', border: '1px solid var(--glass-border)', zIndex: 1000, boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ fontSize: '20px', fontWeight: '600', flexShrink: 0 }}>AuraGuard</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <button onClick={onFocusPakistan} style={buttonStyle} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}>Focus Pakistan</button>
                <button onClick={onResetWorldwide} style={buttonStyle} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}>Worldwide</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search cities..." style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-color)', padding: '5px 0', fontSize: '14px', outline: 'none', width: '100%', minWidth: '150px', transition: 'border-color 0.3s' }} onFocus={(e) => e.target.style.borderBottomColor = 'rgba(255, 255, 255, 0.8)'} onBlur={(e) => e.target.style.borderBottomColor = 'var(--glass-border)'}/>
                <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', marginLeft: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--text-color)', opacity: 0.8}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </button>
            </form>
        </div>
    );
};

const Legend = () => {
    const aqiLevels = [0, 51, 101, 151, 201, 301];
    return (
        <div id="app-legend" style={{ position: 'absolute', bottom: '30px', right: '20px', padding: '15px', background: 'var(--glass-background)', backdropFilter: 'blur(10px) saturate(180%)', WebkitBackdropFilter: 'blur(10px) saturate(180%)', borderRadius: '12px', border: '1px solid var(--glass-border)', zIndex: 1000, boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)' }}>
            <h4 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>AQI Legend</h4>
            {aqiLevels.map(aqi => {
                const info = getAqiInfo(aqi);
                return (
                    <div key={aqi} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                        <span style={{ height: '15px', width: '15px', backgroundColor: info.color, borderRadius: '50%', display: 'inline-block', marginRight: '10px', border: `1px solid ${info.darkColor}` }}></span>
                        <span>{info.classification}</span>
                    </div>
                );
            })}
        </div>
    );
};

// FIX: Explicitly type the props for CustomTooltip and make them optional.
// Recharts injects these props at runtime, and this change satisfies TypeScript's static analysis.
const CustomTooltip = ({ active, payload, label }: { active?: boolean, payload?: any[], label?: string | number }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: 'rgba(30,30,30,0.9)', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                <p style={{ margin: 0, fontSize: 12 }}>{`Date: ${label}`}</p>
                <p style={{ margin: '2px 0 0 0', color: payload[0].stroke, fontSize: 12 }}>{`Avg. AQI: ${payload[0].value}`}</p>
            </div>
        );
    }
    return null;
};

const AqiChart = ({ data, color, view }) => {
    const tickFormatter = (tick) => {
        if (view === 'daily') return new Date(tick).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (view === 'weekly') return `W/C ${new Date(tick).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        if (view === 'monthly') return new Date(tick).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return tick;
    };

    return (
        <div style={{ width: '100%', height: 200, marginTop: '15px' }}>
            <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.2)" />
                    <XAxis dataKey="date" stroke="rgba(255, 255, 255, 0.7)" fontSize={10} tickFormatter={tickFormatter} />
                    <YAxis stroke="rgba(255, 255, 255, 0.7)" fontSize={10} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="aqi" stroke={color} strokeWidth={2} dot={false} name="AQI" />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

const PopupContent = ({ data, aqiInfo }) => {
    const [advice, setAdvice] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [historicalData, setHistoricalData] = useState([]);
    const [dateRange, setDateRange] = useState(() => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
        return { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] };
    });
    const [view, setView] = useState('daily'); // daily, weekly, monthly

    const getAdvice = async () => {
        setIsLoading(true); setError(''); setAdvice('');
        try {
            if (!process.env.API_KEY) throw new Error("API_KEY not set.");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Based on an Air Quality Index (AQI) of ${data.aqi} classified as '${aqiInfo.classification}', provide 2-3 concise health advice bullet points.`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            setAdvice(response.text);
        } catch (err) {
            console.error(err);
            setError('Could not fetch advice.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const toggleHistory = () => {
        if (!showHistory) {
            setHistoricalData(getHistoricalDataForCity(data.city));
        }
        setShowHistory(!showHistory);
    };

    const aggregateData = (data, viewType) => {
        if (viewType === 'daily') return data;
        const aggregated = {};
        data.forEach(d => {
            const date = new Date(d.date);
            let key;
            if (viewType === 'weekly') {
                const day = date.getDay();
                const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                key = new Date(date.setDate(diff)).toISOString().split('T')[0];
            } else { // monthly
                key = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
            }
            if (!aggregated[key]) { aggregated[key] = { total: 0, count: 0 }; }
            aggregated[key].total += d.aqi;
            aggregated[key].count++;
        });
        return Object.keys(aggregated).map(key => ({
            date: key,
            aqi: Math.round(aggregated[key].total / aggregated[key].count)
        }));
    };

    const dataInDateRange = historicalData.filter(d => d.date >= dateRange.start && d.date <= dateRange.end);
    const chartData = aggregateData(dataInDateRange, view);

    const sharedButtonStyle = { width: '100%', padding: '8px', marginTop: '10px', background: 'rgba(255, 255, 255, 0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', transition: 'background 0.2s' };
    const dateInputStyle = { background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '4px', padding: '4px', fontFamily: 'inherit', width: '100%' };
    const viewButtonStyle = (isActive) => ({ background: isActive ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '12px', transition: 'background 0.2s' });

    return (
        <div>
            <h3 style={{ margin: '0 0 5px 0', color: 'white' }}>{data.city}</h3>
            <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>Air Quality Index</p>
            <div style={{ display: 'flex', alignItems: 'baseline', margin: '5px 0' }}>
                <span style={{ fontSize: '32px', fontWeight: 'bold', color: aqiInfo.color }}>{data.aqi}</span>
                <span style={{ marginLeft: '10px', fontWeight: '500' }}>{aqiInfo.classification}</span>
            </div>
            
            {!advice && !isLoading && !error && (
                <button onClick={getAdvice} style={sharedButtonStyle} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}>Get Health Advice</button>
            )}

            {isLoading && <p style={{ margin: '10px 0 0 0', textAlign: 'center' }}>Generating advice...</p>}
            {error && <p style={{ margin: '10px 0 0 0', color: '#ff8a8a' }}>{error}</p>}
            {advice && (
                <div style={{ marginTop: '15px', borderTop: '1px solid var(--glass-border)', paddingTop: '10px' }}>
                    <h4 style={{margin: '0 0 5px 0'}}>Health Advice:</h4>
                    <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '13px', lineHeight: '1.5' }}>{advice}</p>
                </div>
            )}
            
            <button onClick={toggleHistory} style={sharedButtonStyle} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}>
                {showHistory ? 'Hide History' : 'View History'}
            </button>
            
            {showHistory && (
                <div style={{ marginTop: '15px', borderTop: '1px solid var(--glass-border)', paddingTop: '10px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px' }}>
                        <label style={{flex: 1}}>Start<input type="date" style={dateInputStyle} value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} /></label>
                        <label style={{flex: 1}}>End<input type="date" style={dateInputStyle} value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} /></label>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '10px' }}>
                        <button onClick={() => setView('daily')} style={viewButtonStyle(view === 'daily')}>Daily</button>
                        <button onClick={() => setView('weekly')} style={viewButtonStyle(view === 'weekly')}>Weekly</button>
                        <button onClick={() => setView('monthly')} style={viewButtonStyle(view === 'monthly')}>Monthly</button>
                    </div>
                    <AqiChart data={chartData} color={aqiInfo.color} view={view} />
                </div>
            )}
        </div>
    );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
