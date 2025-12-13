<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\ChatController;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\ConversationController; // <--- Yeni Controller Import Edildi

/*
|--------------------------------------------------------------------------
| Public Routes (Herkese Açık)
|--------------------------------------------------------------------------
*/

// Mobil Giriş (Login)
Route::post('/login', [AuthController::class, 'login']);

// Widget İşlemleri (Ziyaretçi Tarafı)
Route::post('/chat/send', [ChatController::class, 'sendMessage']);
Route::post('/chat/typing', [ChatController::class, 'typing']);
Route::post('/chat/read', [ChatController::class, 'markAsRead']);
Route::get('/chat/config', [ChatController::class, 'config']);

/*
|--------------------------------------------------------------------------
| Protected Routes (Sadece Giriş Yapmış Kullanıcılar - Sanctum)
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    
    // Kullanıcı Bilgisi
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Çıkış Yap (Logout)
    Route::post('/logout', [AuthController::class, 'logout']);

    // Sohbet Listesi (Mobil Ana Ekran İçin)
    Route::get('/conversations', [ConversationController::class, 'index']);
    // ... (index rotasının altına)
    Route::get('/conversations/{id}', [ConversationController::class, 'show']);
    Route::post('/conversations/{id}/reply', [ConversationController::class, 'reply']);
    Route::post('/user/device-token', [AuthController::class, 'updateDeviceToken']);

});