<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Events\MessageSent; // <--- EKLENDİ
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

            // 6. REAL-TIME BROADCAST (YAYINLA) <--- EKLENDİ
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
}