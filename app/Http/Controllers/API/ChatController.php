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
                'message' => 'nullable|string|max:1000',
                'attachment' => 'nullable|file|max:10240|mimes:jpeg,png,jpg,gif,pdf,doc,docx,xls,xlsx', 
            ]);

            // Mesaj ve Dosya Kontrolü
            // $request->input('message') kullanarak güvenli erişim sağlıyoruz.
            $messageContent = $request->input('message');

            if (!$request->hasFile('attachment') && empty($messageContent)) {
                return response()->json(['error' => 'Mesaj veya dosya göndermelisiniz.'], 422);
            }

            // 2. Siteyi Bul
            $website = Website::where('widget_token', $validated['widget_token'])->firstOrFail();

            // --- ZİYARETÇİ DETAYLARINI AL ---
            $ip = $request->ip();
            $userAgent = $request->header('User-Agent');
            $currentUrl = $request->input('current_url');

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
                [
                    'website_id' => $website->id,
                    'visitor_id' => $visitor->id,
                    'status' => 'active'
                ]
            );

            // 5. Dosya Yükleme İşlemi (PAYLAŞIMLI SUNUCU UYUMLU)
            $type = 'text';
            $attachmentPath = null;

            if ($request->hasFile('attachment')) {
                $file = $request->file('attachment');
                
                // Dosya türünü belirle
                $type = str_starts_with($file->getMimeType(), 'image/') ? 'image' : 'file';
                
                // Benzersiz dosya ismi oluştur
                $filename = time() . '_' . Str::random(10) . '.' . $file->getClientOriginalExtension();
                
                // Dosyayı doğrudan 'public/attachments' klasörüne taşı
                $file->move(public_path('attachments'), $filename);
                
                // Veritabanına kaydedilecek yol (public hariç)
                $attachmentPath = 'attachments/' . $filename;
            }

            // 6. Mesajı Kaydet
            // Eğer mesaj boşsa ve dosya varsa, body kısmına otomatik metin ekle
            if (empty($messageContent) && $attachmentPath) {
                $messageContent = ($type === 'image') ? '📷 Resim' : '📎 Dosya';
            }

            $message = $conversation->messages()->create([
                'body' => $messageContent,
                'sender_type' => Visitor::class,
                'sender_id' => $visitor->id,
                'type' => $type,
                'attachment_path' => $attachmentPath,
            ]);

            // 7. Broadcast
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

        \App\Events\UserTyping::dispatch($validated['conversation_id'], 'visitor');

        return response()->noContent();
    }

    public function markAsRead(Request $request)
    {
        $validated = $request->validate([
            'widget_token' => 'required|exists:websites,widget_token',
            'conversation_id' => 'required|exists:conversations,id',
        ]);

        \App\Models\Message::where('conversation_id', $validated['conversation_id'])
            ->where('sender_type', \App\Models\User::class)
            ->where('is_read', false)
            ->update(['is_read' => true]);

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