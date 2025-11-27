<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User; // Import
use App\Models\Website; // Eklendi
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DashboardChatController extends Controller
{
 public function index()
    {
        // Adminin sitesini bul (Dinlemek için ID lazım)
        $website = Website::where('user_id', Auth::id())->first();

        $conversations = Conversation::with(['visitor', 'messages'])
            ->whereHas('messages')
            ->where('website_id', $website->id ?? 0) // Sadece bu sitenin sohbetleri
            ->latest('updated_at')
            ->get();

        return Inertia::render('Chats/Index', [
            'conversations' => $conversations,
            'website_id' => $website->id ?? null, // Frontend'e gönderiyoruz
        ]);
    }

    public function show($id)
    {
        // Tekil sohbet detayını getirmek için (İleride kullanacağız, şimdilik dursun)
        $conversation = Conversation::with(['visitor', 'messages'])->findOrFail($id);
        
        return response()->json($conversation);
    }

 public function reply(Request $request, Conversation $conversation)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:1000',
            'temp_id' => 'nullable|string', // <--- YENİ: Validasyon
        ]);

        $message = $conversation->messages()->create([
            'body' => $validated['message'],
            'sender_type' => User::class,
            'sender_id' => Auth::id(),
            'is_read' => true,
        ]);

        $conversation->touch();

        // Temp ID'yi event'e pasla
        MessageSent::dispatch($message, $request->input('temp_id'));

        return back();
    }

    public function destroy(Conversation $conversation)
    {
        // Güvenlik Kontrolü: Bu sohbet, adminin sitelerinden birine mi ait?
        // Adminin sahibi olduğu sitelerin ID'lerini al
        $userWebsiteIds = Website::where('user_id', Auth::id())->pluck('id')->toArray();

        if (!in_array($conversation->website_id, $userWebsiteIds)) {
            abort(403, 'Bu sohbeti silme yetkiniz yok.');
        }

        // Sohbeti ve bağlı mesajları sil (Cascade ayarı db'de varsa mesajlar otomatik gider)
        $conversation->delete();

        return to_route('chats.index'); // Sayfayı yenile
    }

    public function typing(Conversation $conversation)
    {
        // Admin yazıyorsa senderType: 'user'
        \App\Events\UserTyping::dispatch($conversation->id, 'user');

        return response()->noContent();
    }

}