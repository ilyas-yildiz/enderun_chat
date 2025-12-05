<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Website;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use App\Events\MessagesRead; // Okundu eventi için gerekli
use App\Events\MessageSent;  // Mesaj gönderme eventi için

class ConversationController extends Controller
{
    public function index(Request $request)
    {
        // Adminin sahip olduğu sitelerin ID'lerini al
        $websiteIds = Website::where('user_id', Auth::id())->pluck('id');

        // Bu sitelere ait, mesajı olan sohbetleri getir
        $conversations = Conversation::with(['visitor', 'website'])
            ->whereIn('website_id', $websiteIds)
            ->whereHas('messages')
            ->latest('updated_at')
            ->get()
            ->map(function ($conversation) {
                $lastMessage = $conversation->messages()->latest()->first();
                $lastSenderType = $lastMessage ? $lastMessage->sender_type : null;
                
                // Okunmamış ziyaretçi mesajı var mı?
                $hasUnread = $conversation->messages()
                    ->where('sender_type', \App\Models\Visitor::class)
                    ->where('is_read', false)
                    ->exists();

                // Durum Metnini Belirle
                $statusText = 'Okundu'; // Varsayılan (Mor)
                if ($hasUnread) {
                    $statusText = 'Okunmadı'; // Yeşil
                } elseif ($lastSenderType === \App\Models\User::class) {
                    $statusText = 'Cevaplandı'; // Gri
                }
                
                return [
                    'id' => $conversation->id,
                    'visitor_name' => $conversation->visitor->name ?? 'Ziyaretçi',
                    'website_name' => $conversation->website->name ?? 'Site',
                    'last_message' => $lastMessage ? Str::limit($lastMessage->body, 30) : '',
                    'time' => $conversation->updated_at->diffForHumans(),
                    
                    // Renk ayrımı için son gönderen tipi
                    'last_sender_type' => $lastSenderType,
                    'has_unread' => $hasUnread,
                    
                    // YENİ: Metinsel Durum
                    'status_text' => $statusText,
                ];
            });

        return response()->json($conversations);
    }

    public function show($id)
    {
        $conversation = Conversation::with(['messages' => function($q) {
            $q->orderBy('created_at', 'desc'); // En yeni en üstte
        }, 'visitor'])->findOrFail($id);

        // --- YENİ EKLENEN: Okundu İşaretleme Mantığı ---
        // Admin sohbeti açtığı an, ziyaretçi mesajlarını okundu yap
        $unreadMessages = $conversation->messages()
            ->where('sender_type', \App\Models\Visitor::class)
            ->where('is_read', false);
            
        if ($unreadMessages->count() > 0) {
            $unreadMessages->update(['is_read' => true]);
            // Ziyaretçiye ve Web panele "Görüldü" sinyali gönder
            MessagesRead::dispatch($id);
        }

        $messages = $conversation->messages->map(function($msg) {
            return [
                'id' => $msg->id,
                'text' => $msg->body,
                'createdAt' => $msg->created_at,
                'is_admin' => $msg->sender_type === 'App\\Models\\User',
                'type' => $msg->type, 
                'attachment_url' => $msg->attachment_url, 
            ];
        });

        return response()->json([
            'visitor_name' => $conversation->visitor->name ?? 'Ziyaretçi',
            'messages' => $messages
        ]);
    }

    public function reply(Request $request, $id)
    {
        $request->validate([
            'message' => 'nullable|string',
            'attachment' => 'nullable|file|max:10240|mimes:jpeg,png,jpg,gif,pdf,doc,docx',
            'temp_id' => 'nullable|string',
        ]);

        if (!$request->hasFile('attachment') && empty($request->message)) {
            return response()->json(['error' => 'Mesaj veya dosya göndermelisiniz.'], 422);
        }
        
        $conversation = Conversation::findOrFail($id);
        
        $type = 'text';
        $attachmentPath = null;

        // Dosya Yükleme (Public Klasörüne)
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $type = str_starts_with($file->getMimeType(), 'image/') ? 'image' : 'file';
            
            $filename = time() . '_' . Str::random(10) . '.' . $file->getClientOriginalExtension();
            $file->move(public_path('attachments'), $filename);
            
            $attachmentPath = 'attachments/' . $filename;
        }

        // Mesajı Kaydet
        $message = $conversation->messages()->create([
            'body' => $request->message,
            'sender_type' => \App\Models\User::class, // Admin
            'sender_id' => Auth::id(),
            'is_read' => true,
            'type' => $type,
            'attachment_path' => $attachmentPath,
        ]);
        
        $conversation->touch(); 

        // Socket Olayı (Temp ID'yi de gönderiyoruz)
        MessageSent::dispatch($message, $request->input('temp_id'));
        
        return response()->json(['success' => true, 'message' => $message]);
    }
}