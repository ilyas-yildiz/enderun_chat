<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Message extends Model
{
    protected $fillable = ['content', 'is_read'];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    // Mesajı kimin gönderdiğini (User veya Visitor) otomatik çözer
    public function sender(): MorphTo
    {
        return $this->morphTo();
    }
}