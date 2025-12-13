<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExpoNotificationService
{
    protected $apiUrl = 'https://exp.host/--/api/v2/push/send';

    /**
     * Expo'ya Push Bildirimi Gönderir
     *
     * @param string $to Expo Push Token
     * @param string $title Başlık
     * @param string $body İçerik
     * @param array $data Ekstra veri
     */
    public function send($to, $title, $body, $data = [])
    {
        // Token kontrolü
        if (!$to || !str_starts_with($to, 'ExponentPushToken')) {
            Log::warning("Geçersiz Push Token: $to");
            return;
        }

        Log::info("🚀 Bildirim Gönderiliyor... Kime: $to | Mesaj: $body");

        try {
            $response = Http::post($this->apiUrl, [
                'to' => $to,
                'title' => $title,
                'body' => $body,
                'data' => $data,
                'sound' => 'default',
                'badge' => 1,
            ]);

            if ($response->successful()) {
                Log::info("✅ Bildirim Başarıyla İletildi (Expo API).");
            } else {
                Log::error("❌ Bildirim Hatası (Expo API): " . $response->body());
            }

        } catch (\Exception $e) {
            Log::error("❌ Bildirim İstek Hatası: " . $e->getMessage());
        }
    }
}