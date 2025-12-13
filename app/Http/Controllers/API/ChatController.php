<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Events\MessageSent;
use App\Events\MessagesRead;
use App\Events\UserTyping;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Visitor;
use App\Models\Website;
use App\Services\ExpoNotificationService; // <--- YENİ SERVİS EKLENDİ
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log; // Log için

class ChatController extends Controller
{
    public function sendMessage(Request $request)
    {
        // 1. GİRİŞ LOGU: İsteğin geldiğinden emin olalım
        Log::info('ChatController: sendMessage metodu tetiklendi.', ['ip' => $request->ip()]);

        try {
            // 1. Validasyon
            $validated = $request->validate([
                'widget_token' => 'required|uuid|exists:websites,widget_token',
                'visitor_uuid' => 'required|uuid', 
                'message' => 'nullable|string|max:1000',
                'attachment' => 'nullable|file|max:10240|mimes:jpeg,png,jpg,gif,pdf,doc,docx,xls,xlsx', 
            ]);

            if (!$request->hasFile('attachment') && empty($validated['message'])) {
                return response()->json(['error' => 'Mesaj veya dosya göndermelisiniz.'], 422);
            }

            // 2. Siteyi Bul
            $website = Website::where('widget_token', $validated['widget_token'])->firstOrFail();

            // Ziyaretçi İşlemleri
            $ip = $request->ip();
            $userAgent = $request->header('User-Agent');
            $currentUrl = $request->input('current_url');

            $visitor = Visitor::firstOrCreate(
                ['website_id' => $website->id, 'uuid' => $validated['visitor_uuid']],
                ['name' => 'Ziyaretçi ' . Str::random(4)]
            );

            // Ziyaretçi Bilgileri
            $browser = 'Diğer';
            if (str_contains($userAgent, 'Chrome')) $browser = 'Chrome';
            elseif (str_contains($userAgent, 'Firefox')) $browser = 'Firefox';
            elseif (str_contains($userAgent, 'Safari')) $browser = 'Safari';

            $os = 'Diğer';
            if (str_contains($userAgent, 'Windows')) $os = 'Windows';
            elseif (str_contains($userAgent, 'Mac')) $os = 'MacOS';
            elseif (str_contains($userAgent, 'Linux')) $os = 'Linux';
            elseif (str_contains($userAgent, 'Android')) $os = 'Android';
            elseif (str_contains($userAgent, 'iPhone')) $os = 'iOS';

            if (app()->environment('local')) {
                $city = 'Ankara (Local)';
                $country = 'TR';
            } else {
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
                ['website_id' => $website->id, 'visitor_id' => $visitor->id, 'status' => 'active']
            );

            // 5. Dosya Yükleme
            $type = 'text';
            $attachmentPath = null;

            if ($request->hasFile('attachment')) {
                $file = $request->file('attachment');
                $type = str_starts_with($file->getMimeType(), 'image/') ? 'image' : 'file';
                
                $filename = time() . '_' . Str::random(10) . '.' . $file->getClientOriginalExtension();
                $file->move(public_path('attachments'), $filename);
                
                $attachmentPath = 'attachments/' . $filename;
            }

            // 6. Mesajı Kaydet
            $bodyContent = $request->input('message'); 
            if (empty($bodyContent) && $attachmentPath) {
                $bodyContent = ($type === 'image') ? '📷 Resim' : '📎 Dosya';
            }

            $message = $conversation->messages()->create([
                'body' => $bodyContent, 
                'sender_type' => Visitor::class,
                'sender_id' => $visitor->id,
                'type' => $type,
                'attachment_path' => $attachmentPath,
            ]);

            // 7. Broadcast
            MessageSent::dispatch($message);

            // ==========================================
            // 8. PUSH BİLDİRİMİ GÖNDER (LOGLU)
            // ==========================================
            
            $admin = $website->user;

            if (!$admin) {
                Log::warning("Bildirim Hatası: Sitenin sahibi (User) bulunamadı. Site ID: " . $website->id);
            } elseif (!$admin->expo_push_token) {
                Log::warning("Bildirim Hatası: Admin (ID: {$admin->id}) bulundu ama expo_push_token YOK.");
            } else {
                Log::info("Bildirim Hazırlanıyor... Token: " . $admin->expo_push_token);
                
                $notificationBody = $message->type === 'image' 
                    ? '📷 Bir fotoğraf gönderdi' 
                    : ($message->type === 'file' ? '📎 Bir dosya gönderdi' : $message->body);

                (new ExpoNotificationService())->send(
                    $admin->expo_push_token,
                    $visitor->name ?? 'Ziyaretçi', 
                    $notificationBody, 
                    ['conversationId' => $conversation->id] 
                );
            }
            // ==========================================

            return response()->json([
                'success' => true,
                'message' => $message
            ], 201);

        } catch (\Exception $e) {
            // 2. HATA LOGU: Bir sorun olursa buraya düşecek
            Log::error('ChatController Hatası: ' . $e->getMessage() . ' | Satır: ' . $e->getLine());
            
            return response()->json([
                'error' => true,
                'message' => $e->getMessage(),
                'line' => $e->getLine()
            ], 500);
        }
    }
    
    public function typing(Request $request) {
        $validated = $request->validate([
            'widget_token' => 'required|exists:websites,widget_token',
            'conversation_id' => 'required|exists:conversations,id',
        ]);
        UserTyping::dispatch($validated['conversation_id'], 'visitor');
        return response()->noContent();
    }

    public function markAsRead(Request $request) {
         $validated = $request->validate([
            'widget_token' => 'required|exists:websites,widget_token',
            'conversation_id' => 'required|exists:conversations,id',
         ]);

         Message::where('conversation_id', $validated['conversation_id'])
            ->where('sender_type', \App\Models\User::class)
            ->where('is_read', false)
            ->update(['is_read' => true]);

         MessagesRead::dispatch($validated['conversation_id']);
         return response()->noContent();
    }

    public function config(Request $request) {
        $request->validate(['widget_token' => 'required|exists:websites,widget_token']);
        $website = Website::where('widget_token', $request->widget_token)->firstOrFail();
        return response()->json([
            'color' => $website->widget_color,
            'title' => $website->header_text,
            'welcome' => $website->welcome_message,
        ]);
    }
}