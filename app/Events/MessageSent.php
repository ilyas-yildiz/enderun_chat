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
    public $tempId; // <--- YENİ: Geçici ID

    // Constructor'a tempId eklendi
    public function __construct(Message $message, $tempId = null)
    {
        $this->message = $message;
        $this->tempId = $tempId;
    }

    public function broadcastOn(): array
    {
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
            'conversation_id' => $this->message->conversation_id,
            'created_at' => $this->message->created_at->toIso8601String(),
            'visitor' => $this->message->conversation->visitor,
            'temp_id' => $this->tempId, // <--- YENİ: Frontend'e geri gönderiyoruz
        ];
    }
    
    public function broadcastAs(): string
    {
        return 'message.sent';
    }
}