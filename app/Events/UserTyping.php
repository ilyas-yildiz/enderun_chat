<?php

namespace App\Events;

use App\Models\Conversation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow; // Anında iletim
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class UserTyping implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $conversationId;
    public $senderType; // 'visitor' veya 'user'

    public function __construct($conversationId, $senderType)
    {
        $this->conversationId = $conversationId;
        $this->senderType = $senderType;
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('chat.' . $this->conversationId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'client.typing';
    }
}