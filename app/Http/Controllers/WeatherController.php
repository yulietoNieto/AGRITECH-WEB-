<?php

namespace App\Http\Controllers;

use App\Services\WeatherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WeatherController extends Controller
{
    /**
     * Retorna los datos meteorológicos en tiempo real de Carmen de Carupa,
     * Vereda Santuario, obtenidos vía Open-Meteo API (datos reales).
     *
     * Incluye: clima actual, pronóstico 7 días, alertas agrícolas.
     */
    public function getWeather(Request $request): JsonResponse
    {
        $service = new WeatherService();

        $forceRefresh = $request->boolean('refresh', false);
        $weather = $forceRefresh
            ? $service->refreshWeather()
            : $service->getWeather();

        if (!$weather) {
            return response()->json([
                'error'   => true,
                'message' => 'No se pudieron obtener los datos meteorológicos. Intente de nuevo más tarde.',
            ], 503);
        }

        return response()->json($weather);
    }
}
