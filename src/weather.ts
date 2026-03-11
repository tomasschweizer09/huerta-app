export async function getWeatherData() {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=-34.4260&longitude=-58.5796&current=temperature_2m,relative_humidity_2m,precipitation,is_day,precipitation_probability&hourly=temperature_2m,relative_humidity_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,relative_humidity_2m_max,relative_humidity_2m_min&timezone=America%2FSao_Paulo';

    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch weather data");
    const data = await res.json();
    return data;
}
