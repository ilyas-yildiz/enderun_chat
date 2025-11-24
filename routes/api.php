<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\ChatController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// Chat Mesaj Gönderme Rotası (Public)
Route::post('/chat/send', [ChatController::class, 'sendMessage']);