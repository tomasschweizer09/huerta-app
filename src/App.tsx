import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getWeatherData } from './weather';
import { CloudRain, AlertTriangle, Leaf, Calendar, Cloud, History, Sparkles, Home } from 'lucide-react';
import { format, differenceInHours, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface SensorData {
  created_at: string;
  temperatura: number;
  humedad_aire: number;
  humedad_suelo_cruda: number;
}

interface WeatherData {
  current: {
    temperature_2m: number;
    precipitation: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    relative_humidity_2m_max: number[];
    relative_humidity_2m_min: number[];
  };
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SensorData[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [aiResponse, setAiResponse] = useState('');
  const GEMINI_API_KEY = "AIzaSyDFUzfoZhCGze2886DqFeFRiTYRpO0hBBs";
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch weather
        getWeatherData().then(setWeather).catch(console.error);

        // Fetch supabase using explicit column names
        const { data: sbData, error: sbError } = await supabase
          .from('huerta_datos')
          .select('created_at, temperatura, humedad_aire, humedad_suelo_cruda')
          .order('created_at', { ascending: false })
          .limit(20);

        if (sbError) throw sbError;
        if (sbData) setData(sbData as SensorData[]);

      } catch (err: any) {
        setError(err.message || 'Error al obtener datos');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Función para mapear valor analógico a porcentaje (0-100%).
  // El sensor de corriente tira 4095 cuando la humedad es máxima, y 0 cuando está seco.
  const getSueloPercentage = (cruda: number) => {
    if (cruda == null) return 0;
    const minValor = 0;
    const maxValor = 4095;
    const pct = ((cruda - minValor) / (maxValor - minValor)) * 100;
    return Math.max(0, Math.min(100, pct)); // límite entre 0% y 100%
  };

  const handleAskAI = async () => {
    setAiLoading(true);
    setAiResponse('');

    // Build context snippet
    const lastDato = data[0];
    const contexto = `
      Actuá como un experto jardinero. Tengo un sensor en mi huerta que mide la humedad del suelo (0 es seco total, 4095 es humedad total).
      - Último registro hace un rato:
      - Temperatura en huerta: ${lastDato?.temperatura} °C
      - Humedad_aire: ${lastDato?.humedad_aire} %
      - Humedad_suelo_cruda (sensor): ${lastDato?.humedad_suelo_cruda} (esto equivale a un ${getSueloPercentage(lastDato?.humedad_suelo_cruda).toFixed(1)}% de humedad relativa).
      
      Datos meteorológicos actuales externos (Buenos Aires):
      - Temperatura afuera: ${weather?.current.temperature_2m}°C
      - Lluvias pronosticadas hoy: ${weather?.daily.precipitation_sum[0]}mm (Prob: ${weather?.daily.precipitation_probability_max[0]}%)
      - Humedad ambiente esperada hoy: min ${weather?.daily.relative_humidity_2m_min[0]}%, max ${weather?.daily.relative_humidity_2m_max[0]}%
      - Lluvias de mañana: ${weather?.daily.precipitation_sum[1]}mm (Prob: ${weather?.daily.precipitation_probability_max[1]}%)
      - Humedad ambiente esperada mañana: min ${weather?.daily.relative_humidity_2m_min[1]}%, max ${weather?.daily.relative_humidity_2m_max[1]}%
      
      No uses lenguaje complejo ni inventes. Solo decime directamente, en base a la humedad del suelo, humedad del aire, y al pronóstico de lluvia, cuándo me convendría regar y cuánto. Si debería esperar a la lluvia o qué hacer. Mantén la respuesta breve (1-2 párrafos amigables).
    `;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: contexto }] }] })
      });
      const aiData = await res.json();
      if (aiData.error) throw new Error(aiData.error.message);
      setAiResponse(aiData.candidates[0].content.parts[0].text);
    } catch (err: any) {
      setAiResponse("Hubo un error al consultar a Gemini: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loader">
        <div className="spinner"></div>
        <p>Conectando con la huerta...</p>
      </div>
    );
  }

  const latestData = data.length > 0 ? data[0] : null;
  const timeField = latestData?.created_at || new Date().toISOString();
  let hoursSinceLastData = 0;
  try {
    hoursSinceLastData = differenceInHours(new Date(), parseISO(timeField));
  } catch (e) {
    console.error("Date parse error");
  }

  const pctSuelo = latestData ? getSueloPercentage(latestData.humedad_suelo_cruda) : 0;

  return (
    <div className="app-container">
      <div className="header">
        <h1>Mi Huerta</h1>
        <p>Monitoreo inteligente · Tigre, AR</p>
      </div>

      {error && (
        <div className="alert-banner">
          <AlertTriangle size={20} />
          <p>Error: {error}</p>
        </div>
      )}

      {/* --- DASHBOARD TAB --- */}
      {activeTab === 'home' && (
        <>
          {latestData ? (
            <div className="glass-card">
              <div className="metric-header" style={{ marginBottom: 16 }}>
                <Leaf size={16} className="accent-green" />
                <span>Última lectura - Sensores de la Huerta</span>
              </div>
              <div className="timestamp-text">
                {format(parseISO(timeField), "dd MMM, HH:mm", { locale: es })} ({hoursSinceLastData}hs atrás)
              </div>

              <div className="status-grid">
                <div className="metric-card">
                  <div className="metric-header">Hum. Suelo</div>
                  <div className="metric-value" style={{ color: pctSuelo < 30 ? 'var(--danger-red)' : 'var(--accent-green)' }}>
                    {pctSuelo.toFixed(1)}<span className="metric-unit">%</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Crudo: {latestData.humedad_suelo_cruda}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-header">Temp. Sensor</div>
                  <div className="metric-value">
                    {latestData.temperatura.toFixed(1)}<span className="metric-unit">°C</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-header">Hum. Aire</div>
                  <div className="metric-value">
                    {latestData.humedad_aire.toFixed(1)}<span className="metric-unit">%</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-header" style={{ color: 'var(--accent-blue)' }}>Clima Tigre</div>
                  <div className="metric-value" style={{ color: 'var(--accent-blue)' }}>
                    {weather?.current.temperature_2m.toFixed(1)}<span className="metric-unit">°C</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card">No hay datos. Revisá la tabla huerta_datos</div>
          )}

          {weather && (
            <div className="glass-card">
              <div className="metric-header" style={{ marginBottom: 16 }}>
                <Cloud size={16} className="accent-blue" />
                <span>Pronóstico Open-Meteo (Próximos días)</span>
              </div>
              <div className="forecast-list">
                {[0, 1, 2].map(dayIdx => (
                  <div className="forecast-item" key={dayIdx}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Calendar size={18} className="text-secondary" />
                      <span style={{ fontWeight: 500, width: 60, fontSize: 13 }}>
                        {dayIdx === 0 ? 'Hoy' : format(parseISO(weather.daily.time[dayIdx]), "cccc", { locale: es })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 14 }}>
                      <span style={{ color: 'var(--accent-blue)' }}>{weather.daily.temperature_2m_min[dayIdx]}°</span>
                      <span style={{ color: 'var(--danger-red)' }}>{weather.daily.temperature_2m_max[dayIdx]}°</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, width: 65, justifyContent: 'flex-end', color: 'var(--accent-blue)' }}>
                        <CloudRain size={14} /> {weather.daily.precipitation_sum[dayIdx]}mm
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 35 }}>
                        ({weather.daily.precipitation_probability_max[dayIdx]}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* --- HISTORY TAB --- */}
      {activeTab === 'history' && (
        <div className="glass-card">
          <div className="metric-header" style={{ marginBottom: 16 }}>
            <History size={16} />
            <span>Últimos 20 registros</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Suelo (Crudo)</th>
                  <th>Aire Hum.</th>
                  <th>Temp.</th>
                </tr>
              </thead>
              <tbody>
                {data.map(d => (
                  <tr key={d.created_at}>
                    <td>{format(parseISO(d.created_at), "dd/MM HH:mm")}</td>
                    <td>{d.humedad_suelo_cruda}</td>
                    <td>{d.humedad_aire}%</td>
                    <td>{d.temperatura}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- AI TAB --- */}
      {activeTab === 'ai' && (
        <div className="glass-card">
          <div className="metric-header" style={{ marginBottom: 16 }}>
            <Sparkles size={16} className="warning" />
            <span style={{ color: 'var(--warning-yellow)', fontWeight: 600 }}>Decisión de Riego IA</span>
          </div>

          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Consultá a la Inteligencia Artificial de Gemini para que evalúe si te conviene regar o no, basándose en la humedad actual y el pronóstico de los próximos días.
          </p>

          <button
            className="ai-btn"
            onClick={handleAskAI}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <> <div className="spinner" style={{ width: 16, height: 16, borderTopColor: 'white' }}></div> Pensando... </>
            ) : (
              <> <Sparkles size={18} /> Preguntarle a Gemini ahora </>
            )}
          </button>

          {aiResponse && (
            <div className="ai-response">
              {aiResponse}
            </div>
          )}
        </div>
      )}

      {/* BOTTOM TABS */}
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
          <Home size={22} />
          <span>Inicio</span>
        </button>
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <History size={22} />
          <span>Historial</span>
        </button>
        <button className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
          <Sparkles size={22} />
          <span>Riego IA</span>
        </button>
      </div>
    </div>
  );
}
