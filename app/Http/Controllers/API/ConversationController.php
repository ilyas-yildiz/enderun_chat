<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Website;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class ConversationController extends Controller
{
    public function index(Request $request)
    {
        // GÜVENLİK AKTİF: Sadece adminin kendi sitelerini getir
        $websiteIds = Website::where('user_id', Auth::id())->pluck('id');

        $conversations = Conversation::with(['visitor', 'website'])
            ->whereIn('website_id', $websiteIds)
            ->whereHas('messages')
            ->latest('updated_at')
            ->get()
            ->map(function ($conversation) {
                $lastMessage = $conversation->messages()->latest()->first();
                
                return [
                    'id' => $conversation->id,
                    'visitor_name' => $conversation->visitor->name ?? 'Ziyaretçi',
                    'website_name' => $conversation->website->name ?? 'Site',
                    'last_message' => $lastMessage ? Str::limit($lastMessage->body, 30) : '',
                    'time' => $conversation->updated_at->diffForHumans(),
                    // Okunmamış mesaj var mı?
                    'has_unread' => $conversation->messages()
                        ->where('sender_type', \App\Models\Visitor::class)
                        ->where('is_read', false)
                        ->exists(),
                ];
            });

        return response()->json($conversations);
    }
    
    // YENİ: Tekil Sohbetin Mesajlarını Getir
    public function show($id)
    {
        $conversation = Conversation::with(['messages' => function($q) {
            $q->orderBy('created_at', 'desc'); // En yeni en üstte (Chat arayüzü için)
        }, 'visitor'])->findOrFail($id);

        // Mobilde listelemek için veriyi düzenle
        $messages = $conversation->messages->map(function($msg) {
            return [
                'id' => $msg->id,
                'text' => $msg->body,
                'createdAt' => $msg->created_at,
                // Gönderen Admin mi (User) yoksa Ziyaretçi mi?
                'is_admin' => $msg->sender_type === 'App\\Models\\User',
            ];
        });

        return response()->json([
            'visitor_name' => $conversation->visitor->name ?? 'Ziyaretçi',
            'messages' => $messages
        ]);
    }

    // YENİ: Cevap Yaz
    public function reply(Request $request, $id)
    {
        $request->validate(['message' => 'required|string']);
        
        $conversation = Conversation::findOrFail($id);
        
        // Mesajı Kaydet
        $message = $conversation->messages()->create([
            'body' => $request->message,
            'sender_type' => \App\Models\User::class, // Admin
            'sender_id' => Auth::id(),
            'is_read' => true,
        ]);
        
        $conversation->touch(); // Updated_at güncellensin

        // Reverb (Socket) Olayını Tetikle (Ziyaretçi görsün diye)
        \App\Events\MessageSent::dispatch($message);
        
        return response()->json(['success' => true]);
    }
}