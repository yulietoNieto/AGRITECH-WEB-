<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WeatherService
{
    /**
     * Coordenadas de Carmen de Carupa, Cundinamarca — Vereda Santuario
     * Altitud aproximada: 2,980 msnm
     */
    private const LATITUDE  = 5.3450;
    private const LONGITUDE = -73.9826;
    private const ALTITUDE  = 2980;
    private const TIMEZONE  = 'America/Bogota';

    private const CACHE_KEY = 'weather_carmen_carupa';
    private const CACHE_TTL = 900; // 15 minutos

    /**
     * Obtiene los datos meteorológicos actuales y pronóstico de 7 días.
     * Usa caché para evitar llamadas excesivas a la API.
     */
    public function getWeather(): ?array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            return $this->fetchFromAPI();
        });
    }

    /**
     * Fuerza una recarga desde la API (ignora caché).
     */
    public function refreshWeather(): ?array
    {
        Cache::forget(self::CACHE_KEY);
        return $this->getWeather();
    }

    /**
     * Realiza la petición HTTP a Open-Meteo y estructura la respuesta.
     */
    private function fetchFromAPI(): ?array
    {
        try {
            $response = Http::timeout(10)->get('https://api.open-meteo.com/v1/forecast', [
                'latitude'  => self::LATITUDE,
                'longitude' => self::LONGITUDE,
                'current'   => implode(',', [
                    'temperature_2m',
                    'relative_humidity_2m',
                    'apparent_temperature',
                    'is_day',
                    'precipitation',
                    'rain',
                    'weather_code',
                    'wind_speed_10m',
                    'surface_pressure',
                ]),
                'daily' => implode(',', [
                    'weather_code',
                    'temperature_2m_max',
                    'temperature_2m_min',
                    'precipitation_sum',
                    'precipitation_probability_max',
                    'wind_speed_10m_max',
                ]),
                'timezone'    => self::TIMEZONE,
                'forecast_days' => 7,
            ]);

            if (!$response->successful()) {
                Log::warning('Open-Meteo API error', ['status' => $response->status()]);
                return null;
            }

            $data = $response->json();

            return $this->formatResponse($data);
        } catch (\Exception $e) {
            Log::error('WeatherService error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Estructura la respuesta de la API en un formato limpio para el frontend.
     */
    private function formatResponse(array $raw): array
    {
        $current = $raw['current'] ?? [];
        $daily   = $raw['daily'] ?? [];

        $weatherCode = $current['weather_code'] ?? 0;
        $weatherInfo = $this->translateWeatherCode($weatherCode);

        $currentData = [
            'temperature'          => $current['temperature_2m'] ?? null,
            'feels_like'           => $current['apparent_temperature'] ?? null,
            'humidity'             => $current['relative_humidity_2m'] ?? null,
            'precipitation'        => $current['precipitation'] ?? 0,
            'rain'                 => $current['rain'] ?? 0,
            'wind_speed'           => $current['wind_speed_10m'] ?? null,
            'pressure'             => $current['surface_pressure'] ?? null,
            'is_day'               => (bool) ($current['is_day'] ?? true),
            'weather_code'         => $weatherCode,
            'weather_description'  => $weatherInfo['description'],
            'weather_icon'         => $weatherInfo['icon'],
        ];

        // Pronóstico 7 días
        $forecast = [];
        $dates = $daily['time'] ?? [];
        for ($i = 0; $i < count($dates); $i++) {
            $dayCode = $daily['weather_code'][$i] ?? 0;
            $dayWeather = $this->translateWeatherCode($dayCode);

            $forecast[] = [
                'date'              => $dates[$i],
                'day_name'          => $this->spanishDayName($dates[$i]),
                'temp_max'          => $daily['temperature_2m_max'][$i] ?? null,
                'temp_min'          => $daily['temperature_2m_min'][$i] ?? null,
                'precipitation'     => $daily['precipitation_sum'][$i] ?? 0,
                'precip_probability'=> $daily['precipitation_probability_max'][$i] ?? 0,
                'wind_max'          => $daily['wind_speed_10m_max'][$i] ?? null,
                'weather_code'      => $dayCode,
                'description'       => $dayWeather['description'],
                'icon'              => $dayWeather['icon'],
            ];
        }

        // Alertas agrícolas para cultivo de papa
        $alerts = $this->calculateAgriAlerts($currentData, $forecast);

        return [
            'location' => [
                'name'      => 'Vereda Santuario',
                'municipality' => 'Carmen de Carupa',
                'department'   => 'Cundinamarca',
                'latitude'     => self::LATITUDE,
                'longitude'    => self::LONGITUDE,
                'altitude'     => self::ALTITUDE,
            ],
            'current'    => $currentData,
            'forecast'   => $forecast,
            'alerts'     => $alerts,
            'data_source' => [
                'provider'  => 'Open-Meteo API',
                'type'      => 'Datos reales vía API',
                'note'      => 'Temperatura y humedad ambiental son datos reales obtenidos de modelos meteorológicos (ECMWF/GFS). La humedad del suelo y nutrientes (NPK) son simulados con modelos estadísticos para cultivo de papa.',
                'cached_at' => now()->toIso8601String(),
            ],
        ];
    }

    /**
     * Calcula alertas agrícolas específicas para el cultivo de papa en zona de páramo.
     */
    private function calculateAgriAlerts(array $current, array $forecast): array
    {
        $alerts = [];

        // ─── Alerta de Helada ───
        // La papa es sensible a temperaturas < 4°C (muerte foliar)
        $temp = $current['temperature'] ?? 15;
        if ($temp <= 4) {
            $alerts[] = [
                'type'     => 'frost',
                'severity' => $temp <= 0 ? 'critical' : 'warning',
                'icon'     => 'fas fa-snowflake',
                'title'    => $temp <= 0 ? '❄️ HELADA SEVERA' : '🥶 RIESGO DE HELADA',
                'message'  => $temp <= 0
                    ? "Temperatura actual: {$temp}°C. PELIGRO EXTREMO para el cultivo de papa. Riesgo de daño irreversible al follaje. Activar protección inmediata (coberturas, riego por aspersión)."
                    : "Temperatura actual: {$temp}°C. Riesgo moderado de helada. Monitorear durante la madrugada. Considerar coberturas protectoras.",
            ];
        }

        // Verificar heladas en pronóstico (temperaturas mínimas)
        foreach ($forecast as $day) {
            if (($day['temp_min'] ?? 15) <= 4) {
                $alerts[] = [
                    'type'     => 'frost_forecast',
                    'severity' => 'info',
                    'icon'     => 'fas fa-temperature-low',
                    'title'    => "🌡️ Helada pronosticada: {$day['day_name']}",
                    'message'  => "Temperatura mínima esperada: {$day['temp_min']}°C el {$day['day_name']}. Preparar medidas de protección contra heladas.",
                ];
                break; // Solo la primera alerta de helada futura
            }
        }

        // ─── Riesgo de Gota / Tizón Tardío (Phytophthora infestans) ───
        // Condiciones favorables: Humedad > 85%, Temp 10-20°C, precipitación
        $humidity = $current['humidity'] ?? 50;
        $precip   = $current['precipitation'] ?? 0;
        if ($humidity > 85 && $temp >= 10 && $temp <= 20 && $precip > 0) {
            $alerts[] = [
                'type'     => 'blight',
                'severity' => $humidity > 90 ? 'critical' : 'warning',
                'icon'     => 'fas fa-disease',
                'title'    => '🍂 RIESGO DE GOTA (Tizón Tardío)',
                'message'  => "Humedad: {$humidity}%, Temp: {$temp}°C, Precipitación: {$precip}mm. Condiciones favorables para Phytophthora infestans. Considerar aplicación preventiva de fungicida.",
            ];
        } elseif ($humidity > 85 && $temp >= 10 && $temp <= 20) {
            $alerts[] = [
                'type'     => 'blight',
                'severity' => 'info',
                'icon'     => 'fas fa-shield-virus',
                'title'    => '⚠️ Condiciones Húmedas',
                'message'  => "Humedad relativa alta ({$humidity}%) con temperatura favorable ({$temp}°C). Vigilar aparición de manchas foliares.",
            ];
        }

        // ─── Recomendación de Riego ───
        $precipProb = $forecast[0]['precip_probability'] ?? 0;
        $precipSum  = $forecast[0]['precipitation'] ?? 0;
        if ($precipProb < 20 && $precipSum < 2) {
            $alerts[] = [
                'type'     => 'irrigation',
                'severity' => 'info',
                'icon'     => 'fas fa-tint',
                'title'    => '💧 Riego Recomendado',
                'message'  => "Baja probabilidad de lluvia hoy ({$precipProb}%). Considerar riego complementario para mantener la humedad del suelo.",
            ];
        } elseif ($precipProb > 70) {
            $alerts[] = [
                'type'     => 'rain',
                'severity' => 'info',
                'icon'     => 'fas fa-cloud-rain',
                'title'    => '🌧️ Lluvias Esperadas',
                'message'  => "Alta probabilidad de lluvia hoy ({$precipProb}%). No se requiere riego adicional. Verificar drenaje de parcelas.",
            ];
        }

        // ─── Viento Fuerte ───
        $wind = $current['wind_speed'] ?? 0;
        if ($wind > 40) {
            $alerts[] = [
                'type'     => 'wind',
                'severity' => 'warning',
                'icon'     => 'fas fa-wind',
                'title'    => '💨 Viento Fuerte',
                'message'  => "Velocidad del viento: {$wind} km/h. Riesgo de daño mecánico al follaje. Evaluar tutoraje y protecciones.",
            ];
        }

        return $alerts;
    }

    /**
     * Traduce un código WMO de clima a descripción en español + ícono FontAwesome.
     * @see https://open-meteo.com/en/docs (WMO Weather interpretation codes)
     */
    private function translateWeatherCode(int $code): array
    {
        return match (true) {
            $code === 0  => ['description' => 'Cielo despejado',          'icon' => 'fas fa-sun'],
            $code === 1  => ['description' => 'Mayormente despejado',     'icon' => 'fas fa-sun'],
            $code === 2  => ['description' => 'Parcialmente nublado',     'icon' => 'fas fa-cloud-sun'],
            $code === 3  => ['description' => 'Nublado',                  'icon' => 'fas fa-cloud'],
            in_array($code, [45, 48]) => ['description' => 'Niebla',     'icon' => 'fas fa-smog'],
            in_array($code, [51, 53, 55]) => ['description' => 'Llovizna','icon' => 'fas fa-cloud-rain'],
            in_array($code, [56, 57]) => ['description' => 'Llovizna helada', 'icon' => 'fas fa-icicles'],
            in_array($code, [61, 63]) => ['description' => 'Lluvia',     'icon' => 'fas fa-cloud-showers-heavy'],
            $code === 65 => ['description' => 'Lluvia intensa',           'icon' => 'fas fa-cloud-showers-heavy'],
            in_array($code, [66, 67]) => ['description' => 'Lluvia helada', 'icon' => 'fas fa-icicles'],
            in_array($code, [71, 73, 75]) => ['description' => 'Nevada', 'icon' => 'fas fa-snowflake'],
            $code === 77 => ['description' => 'Granizo',                  'icon' => 'fas fa-cloud-meatball'],
            in_array($code, [80, 81, 82]) => ['description' => 'Aguacero', 'icon' => 'fas fa-cloud-showers-heavy'],
            in_array($code, [85, 86]) => ['description' => 'Nevada',     'icon' => 'fas fa-snowflake'],
            $code === 95 => ['description' => 'Tormenta eléctrica',       'icon' => 'fas fa-bolt'],
            in_array($code, [96, 99]) => ['description' => 'Tormenta con granizo', 'icon' => 'fas fa-poo-storm'],
            default      => ['description' => 'Variable',                 'icon' => 'fas fa-cloud'],
        };
    }

    /**
     * Convierte fecha ISO a nombre de día en español.
     */
    private function spanishDayName(string $date): string
    {
        $days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        $dayOfWeek = (int) date('w', strtotime($date));
        return $days[$dayOfWeek];
    }

    /**
     * Obtiene un resumen textual para inyectar en el prompt del chatbot.
     */
    public function getWeatherSummaryForChatbot(): string
    {
        $weather = $this->getWeather();

        if (!$weather) {
            return 'No se pudieron obtener los datos meteorológicos actuales.';
        }

        $c = $weather['current'];
        $loc = $weather['location'];
        $alerts = $weather['alerts'];

        $summary = "DATOS METEOROLÓGICOS REALES EN TIEMPO REAL (vía Open-Meteo API):\n";
        $summary .= "📍 Ubicación: {$loc['name']}, {$loc['municipality']}, {$loc['department']} ({$loc['altitude']} msnm)\n";
        $summary .= "🌡️ Temperatura: {$c['temperature']}°C (Sensación: {$c['feels_like']}°C)\n";
        $summary .= "💧 Humedad Relativa: {$c['humidity']}%\n";
        $summary .= "🌧️ Precipitación: {$c['precipitation']}mm\n";
        $summary .= "💨 Viento: {$c['wind_speed']} km/h\n";
        $summary .= "🌤️ Clima: {$c['weather_description']}\n";

        if (!empty($alerts)) {
            $summary .= "\nALERTAS AGRÍCOLAS ACTIVAS:\n";
            foreach ($alerts as $alert) {
                $summary .= "- [{$alert['severity']}] {$alert['title']}: {$alert['message']}\n";
            }
        }

        // Pronóstico próximos 3 días
        $summary .= "\nPRONÓSTICO PRÓXIMOS 3 DÍAS:\n";
        foreach (array_slice($weather['forecast'], 0, 3) as $day) {
            $summary .= "- {$day['day_name']}: {$day['temp_min']}°C – {$day['temp_max']}°C, {$day['description']}, Prob. lluvia: {$day['precip_probability']}%\n";
        }

        $summary .= "\nNOTA IMPORTANTE: Los datos de TEMPERATURA y HUMEDAD AMBIENTAL son DATOS REALES obtenidos vía API meteorológica. ";
        $summary .= "Los datos de HUMEDAD DEL SUELO y NUTRIENTES (NPK) son SIMULADOS con modelos estadísticos para cultivo de papa (limitación declarada: requieren sensores físicos).";

        return $summary;
    }
}
