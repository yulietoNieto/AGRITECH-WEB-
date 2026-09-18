<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SensorController;
use App\Http\Controllers\WeatherController;
use Illuminate\Support\Facades\Route;

// Public auth routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login',    [AuthController::class, 'login']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me',      [AuthController::class, 'me']);

    // Dashboard
    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    Route::get('/sensors/realtime',  [DashboardController::class, 'realtime']);

    // Weather — Datos meteorológicos reales vía Open-Meteo API
    Route::get('/weather', [WeatherController::class, 'getWeather']);

    // Sensors
    Route::get('/sensors',         [SensorController::class, 'index']);
    Route::get('/sensors/history', [SensorController::class, 'history']);
    Route::post('/sensors/reading',[SensorController::class, 'store']);

    // Reports
    Route::post('/reports/generate', [ReportController::class, 'generate']);
    Route::get('/reports',           [ReportController::class, 'index']);
    Route::get('/reports/{report}/download', [ReportController::class, 'download']);

    // Chatbot
    Route::post('/chatbot/ask', [\App\Http\Controllers\ChatbotController::class, 'ask']);
});
