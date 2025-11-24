<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;

    public function __construct(Message $message)
    {
        $this->message = $message;
    }

    public function broadcastOn(): array
    {
        // 1. Sohbet Odası (Detay sayfası için)
        // 2. Website Kanalı (Dashboard listesi için)
        return [
            new Channel('chat.' . $this->message->conversation_id),
            new Channel('website.' . $this->message->conversation->website_id),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'body' => $this->message->body,
            'sender_type' => $this->message->sender_type,
            'conversation_id' => $this->message->conversation_id, // Bunu ekledik ki listede hangisi olduğunu bulalım
            'created_at' => $this->message->created_at->toIso8601String(),
            // Ziyaretçi bilgisini de gönderelim ki yeni sohbetse listede adı görünsün
            'visitor' => $this->message->conversation->visitor, 
        ];
    }
    
    public function broadcastAs(): string
    {
        return 'message.sent';
    }
}