<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Models\Website;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Inertia\Inertia;

class DashboardChatController extends Controller
{
    public function index()
    {
        // Adminin sahip olduğu TÜM site ID'lerini al
        $websiteIds = Website::where('user_id', Auth::id())->pluck('id');

        // Bu sitelere ait tüm sohbetleri getir
        $conversations = Conversation::with(['visitor', 'messages'])
            ->whereIn('website_id', $websiteIds)
            ->whereHas('messages')
            ->latest('updated_at')
            ->get();

        return Inertia::render('Chats/Index', [
            'conversations' => $conversations,
        ]);
    }

    // GÜNCELLENEN METOD: Dosya Desteği Eklendi
    public function reply(Request $request, Conversation $conversation)
    {
        $validated = $request->validate([
            'message' => 'nullable|string|max:1000', // Mesaj opsiyonel olabilir (sadece resim varsa)
            'attachment' => 'nullable|file|max:10240|mimes:jpeg,png,jpg,gif,pdf,doc,docx,xls,xlsx',
            'temp_id' => 'nullable|string',
        ]);

        if (!$request->hasFile('attachment') && empty($validated['message'])) {
             return back()->withErrors(['message' => 'Mesaj veya dosya göndermelisiniz.']);
        }

        $type = 'text';
        $attachmentPath = null;

        // Dosya Yükleme İşlemi (Public Klasörüne)
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $type = str_starts_with($file->getMimeType(), 'image/') ? 'image' : 'file';
            
            $filename = time() . '_' . Str::random(10) . '.' . $file->getClientOriginalExtension();
            $file->move(public_path('attachments'), $filename);
            
            $attachmentPath = 'attachments/' . $filename;
        }

        $message = $conversation->messages()->create([
            'body' => $validated['message'],
            'sender_type' => User::class,
            'sender_id' => Auth::id(),
            'is_read' => true,
            'type' => $type,
            'attachment_path' => $attachmentPath,
        ]);

        $conversation->touch();

        // Reverb'e Gönder
        MessageSent::dispatch($message, $request->input('temp_id'));

        return back();
    }
}