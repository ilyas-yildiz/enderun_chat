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
        // ... (Index metodu aynı kalacak) ...
        // Kopyala-Yapıştır yaparken index metodunu bozmamaya dikkat et.
        // Eğer tamamını istiyorsan aşağıya tam dosya koyuyorum.
        
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
                    'has_unread' => $conversation->messages()
                        ->where('sender_type', \App\Models\Visitor::class)
                        ->where('is_read', false)
                        ->exists(),
                ];
            });

        return response()->json($conversations);
    }

    // GÜNCELLENEN METOD: Resim Yollarını da Gönder
    public function show($id)
    {
        $conversation = Conversation::with(['messages' => function($q) {
            $q->orderBy('created_at', 'desc');
        }, 'visitor'])->findOrFail($id);

        $messages = $conversation->messages->map(function($msg) {
            return [
                'id' => $msg->id,
                'text' => $msg->body,
                'createdAt' => $msg->created_at,
                'is_admin' => $msg->sender_type === 'App\\Models\\User',
                // YENİ ALANLAR:
                'type' => $msg->type, 
                'attachment_url' => $msg->attachment_url, // Modeldeki Accessor sayesinde URL gelir
            ];
        });

        return response()->json([
            'visitor_name' => $conversation->visitor->name ?? 'Ziyaretçi',
            'messages' => $messages
        ]);
    }

   public function reply(Request $request, $id)
    {
        // Validasyon: Mesaj boş olabilir ama o zaman dosya olmalı
        $request->validate([
            'message' => 'nullable|string',
            'attachment' => 'nullable|file|max:10240|mimes:jpeg,png,jpg,gif,pdf,doc,docx',
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
            
            $filename = time() . '_' . \Illuminate\Support\Str::random(10) . '.' . $file->getClientOriginalExtension();
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

        // Socket Olayı
        \App\Events\MessageSent::dispatch($message);
        
        return response()->json(['success' => true, 'message' => $message]);
    }
}