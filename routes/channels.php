<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Bizim sohbet kanalı (Şimdilik herkese açık dönüyoruz, sonra kısıtlarız)
Broadcast::channel('chat.{conversationId}', function ($user, $conversationId) {
    return true; 
});