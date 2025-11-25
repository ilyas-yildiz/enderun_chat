<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Visitor;
use App\Models\Website;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ChatController extends Controller
{
    public function sendMessage(Request $request)
    {
        try {
            // 1. Validasyon
            $validated = $request->validate([
                'widget_token' => 'required|uuid|exists:websites,widget_token',
                'visitor_uuid' => 'required|uuid', 
                'message' => 'required|string|max:1000',
            ]);

            // 2. Siteyi Bul
            $website = Website::where('widget_token', $validated['widget_token'])->firstOrFail();

            // --- ZİYARETÇİ DETAYLARINI AL ---
            $ip = $request->ip();
            $userAgent = $request->header('User-Agent');
            $currentUrl = $request->input('current_url'); // Frontend'den gelen URL

            // 3. Ziyaretçiyi Bul veya Oluştur
            $visitor = Visitor::firstOrCreate(
                [
                    'website_id' => $website->id,
                    'uuid' => $validated['visitor_uuid']
                ],
                [
                    'name' => 'Ziyaretçi ' . Str::random(4),
                    'email' => null,
                ]
            );

            // --- ZİYARETÇİ BİLGİLERİNİ GÜNCELLE ---
            // Basit User-Agent Analizi
            $browser = 'Diğer';
            if (str_contains($userAgent, 'Chrome')) $browser = 'Chrome';
            elseif (str_contains($userAgent, 'Firefox')) $browser = 'Firefox';
            elseif (str_contains($userAgent, 'Safari') && !str_contains($userAgent, 'Chrome')) $browser = 'Safari';
            elseif (str_contains($userAgent, 'Edge')) $browser = 'Edge';

            $os = 'Diğer';
            if (str_contains($userAgent, 'Windows')) $os = 'Windows';
            elseif (str_contains($userAgent, 'Mac')) $os = 'MacOS';
            elseif (str_contains($userAgent, 'Linux')) $os = 'Linux';
            elseif (str_contains($userAgent, 'Android')) $os = 'Android';
            elseif (str_contains($userAgent, 'iPhone') || str_contains($userAgent, 'iPad')) $os = 'iOS';

        // --- KONUM BELİRLEME (GÜNCELLENDİ) ---
            // Docker IP karmaşasını önlemek için direkt ortam kontrolü yapıyoruz.
            if (app()->environment('local')) {
                $city = 'Ankara (Local)';
                $country = 'TR';
            } else {
                // TODO: Canlı sunucuda buraya 'stevebauman/location' paketi eklenecek.
                $city = null;
                $country = null;
            }

            $visitor->update([
                'ip_address' => $ip,
                'user_agent' => $userAgent,
                'browser' => $browser,
                'os' => $os,
                'current_url' => $currentUrl,
                'city' => $city,
                'country' => $country,
            ]);

            // 4. Konuşma Başlat
            $conversation = Conversation::firstOrCreate(
                [
                    'website_id' => $website->id,
                    'visitor_id' => $visitor->id,
                    'status' => 'active'
                ]
            );

            // 5. Mesajı Kaydet
            $message = $conversation->messages()->create([
                'body' => $validated['message'],
                'sender_type' => Visitor::class,
                'sender_id' => $visitor->id,
            ]);

            // 6. REAL-TIME BROADCAST (YAYINLA)
            MessageSent::dispatch($message);

            return response()->json([
                'success' => true,
                'message' => $message
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'error' => true,
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ], 500);
        }
    }

    public function typing(Request $request)
    {
        $validated = $request->validate([
            'widget_token' => 'required|exists:websites,widget_token',
            'conversation_id' => 'required|exists:conversations,id',
        ]);

        // Olayı fırlat
        // Ziyaretçi yazıyorsa senderType: 'visitor'
        \App\Events\UserTyping::dispatch($validated['conversation_id'], 'visitor');

        return response()->noContent();
    }

    public function markAsRead(Request $request)
    {
        $validated = $request->validate([
            'widget_token' => 'required|exists:websites,widget_token',
            'conversation_id' => 'required|exists:conversations,id',
        ]);

        // Bu sohbetteki, ADMIN (User) tarafından atılmış ve henüz okunmamış mesajları bul
        // ve hepsini 'okundu' yap.
        \App\Models\Message::where('conversation_id', $validated['conversation_id'])
            ->where('sender_type', \App\Models\User::class) // Sadece Admin mesajları
            ->where('is_read', false)
            ->update(['is_read' => true]);

        // Admin paneline "Okundu" sinyali gönder
        \App\Events\MessagesRead::dispatch($validated['conversation_id']);

        return response()->noContent();
    }

    public function config(Request $request)
    {
        $request->validate([
            'widget_token' => 'required|exists:websites,widget_token',
        ]);

        $website = Website::where('widget_token', $request->widget_token)->firstOrFail();

        return response()->json([
            'color' => $website->widget_color,
            'title' => $website->header_text,
            'welcome' => $website->welcome_message,
        ]);
    }
}