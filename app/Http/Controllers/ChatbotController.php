<?php

namespace App\Http\Controllers;

use App\Services\WeatherService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ChatbotController extends Controller
{
    /**
     * Maneja las consultas al chatbot usando la API de Gemini.
     * Contexto personalizado con la descripción oficial del usuario.
     * Incluye datos meteorológicos REALES de Carmen de Carupa vía Open-Meteo API.
     */
    public function ask(Request $request)
    {
        $request->validate([
            'message' => 'required|string|max:1000',
            'lang' => 'nullable|string|in:es,en',
        ]);

        $apiKey = config('services.gemini.key');
        
        if (!$apiKey || $apiKey === 'YOUR_API_KEY_HERE') {
            return response()->json(['message' => 'API Key no configurada.'], 500);
        }

        $userMessage = $request->input('message');
        $lang = $request->input('lang', 'es');

        // Obtener datos meteorológicos reales para inyectar al contexto
        $weatherContext = '';
        try {
            $weatherService = new WeatherService();
            $weatherContext = "\n\n" . $weatherService->getWeatherSummaryForChatbot();
        } catch (\Exception $e) {
            Log::warning('No se pudieron inyectar datos meteorológicos al chatbot: ' . $e->getMessage());
        }

        $systemPrompt = "Eres 'Agri-Bot', el asistente experto oficial de AGRITECH.
        
        DECLARACIÓN INSTITUCIONAL (Tu identidad fundamental):
        'Soy LIBRE, AUTÓNOMO Y RESPONSABLE a través del diálogo y la construcción, como ideal regulativo; me dirijo, controlo y dicto mis propias leyes.'
        
        CONTESTA SIEMPRE EN EL IDIOMA QUE TE ESCRIBA EL USUARIO (Español o Inglés).
        
        DEFINICIÓN OFICIAL (ESPAÑOL):
        🌱 Agritech es un sistema inteligente desarrollado para mejorar la producción agrícola mediante el uso de tecnologías IoT, sensores inteligentes e inteligencia artificial.
        El proyecto permite monitorear en tiempo real variables importantes del cultivo como: Humedad del suelo, Temperatura ambiental, Niveles de nutrientes y Condiciones climáticas.
        Con esta información, Agritech analiza los datos y genera recomendaciones automáticas para optimizar el riego, el uso de fertilizantes y el control del cultivo.
        🚜 Tecnologías: Sensores IoT, IA, Machine Learning, Automatización, Análisis en tiempo real.

        OFFICIAL DEFINITION (ENGLISH):
        🌱 Agritech is an intelligent system developed to improve agricultural production through the use of IoT technologies, smart sensors, and artificial intelligence.
        The project allows real-time monitoring of important crop variables such as: Soil moisture, Ambient temperature, Nutrient levels, and Weather conditions.
        With this information, Agritech analyzes the data and generates automatic recommendations to optimize irrigation, fertilizer use, and crop control.
        🚜 Technologies: IoT Sensors, AI, Machine Learning, Automation, Real-time data analysis.

        TRANSPARENCIA SOBRE LOS DATOS:
        - DATOS REALES (vía API meteorológica Open-Meteo): Temperatura ambiental, humedad relativa del aire, precipitación, viento, presión atmosférica, pronóstico y alertas agrícolas.
        - DATOS SIMULADOS (limitación declarada): Humedad del suelo y nutrientes NPK. Estos requieren sensores físicos enterrados que actualmente no están implementados. Se simulan con modelos estadísticos razonables para cultivo de papa en zona de páramo (2,980 msnm).
        - Cuando el usuario pregunte por clima, temperatura o humedad ambiental, usa los datos reales proporcionados abajo.
        - Cuando el usuario pregunte por humedad del suelo o nutrientes, aclara que son datos simulados.
        
        REGLAS / RULES:
        1. If the user asks in English, use the English definition. If in Spanish, use the Spanish one.
        2. Respond professionally and helpfully.
        3. Do not invent technologies.
        4. Tone: Expert Systems Engineering student.
        5. When answering about weather or climate, ALWAYS use the real-time data provided below. Never invent weather data." . $weatherContext;

        $modelsToTry = [
            ['ver' => 'v1beta', 'mod' => 'gemini-flash-latest'],
            ['ver' => 'v1beta', 'mod' => 'gemini-pro-latest'],
            ['ver' => 'v1beta', 'mod' => 'gemini-2.5-flash-lite'],
        ];

        foreach ($modelsToTry as $config) {
            try {
                $url = "https://generativelanguage.googleapis.com/{$config['ver']}/models/{$config['mod']}:generateContent?key={$apiKey}";
                
                $response = Http::withHeaders(['Content-Type' => 'application/json'])
                    ->post($url, [
                        'contents' => [
                            ['parts' => [['text' => $systemPrompt . "\n\nUsuario: " . $userMessage]]]
                        ]
                    ]);

                if ($response->successful()) {
                    $data = $response->json();
                    $aiResponse = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
                    if ($aiResponse) {
                        return response()->json(['message' => $aiResponse]);
                    }
                }
            } catch (\Exception $e) {
                Log::error("Excepción con {$config['mod']}: " . $e->getMessage());
            }
        }

        return response()->json(['message' => 'Error de conexión con Agri-Bot.'], 500);
    }
}

