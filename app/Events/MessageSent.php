<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow; // Anında iletim için
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;

    /**
     * Create a new event instance.
     */
    public function __construct(Message $message)
    {
        $this->message = $message;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        // Her konuşmanın kendi özel kanalı olacak: chat.1, chat.5 vb.
        return [
            new Channel('chat.' . $this->message->conversation_id),
        ];
    }

    /**
     * Broadcast edilecek veriyi belirle.
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'body' => $this->message->body,
            'sender_type' => $this->message->sender_type,
            'created_at' => $this->message->created_at->toIso8601String(),
        ];
    }
    
    /**
     * Event adı (Frontend'de dinlerken kullanılacak)
     */
    public function broadcastAs(): string
    {
        return 'message.sent';
    }
}